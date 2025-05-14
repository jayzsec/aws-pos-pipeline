import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiConstructProps {
  environment: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  productsTable: dynamodb.Table;
  transactionsTable: dynamodb.Table;
}

export class ApiConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: ecs.Cluster;
  public readonly repository: ecr.Repository;
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { environment, userPool, userPoolClient, productsTable, transactionsTable } = props;
    const isProd = environment === 'prod';
    
    // Create VPC for the Fargate containers
    this.vpc = new ec2.Vpc(this, 'PosVPC', {
      maxAzs: isProd ? 2 : 1,
      natGateways: isProd ? 2 : 1, // For cost savings in non-prod environments
    });

    // Create ECR Repository for Docker images
    this.repository = new ecr.Repository(this, 'PosRepository', {
      repositoryName: `pos-system-${environment}`,
      imageScanOnPush: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'PosCluster', {
      vpc: this.vpc,
      clusterName: `pos-cluster-${environment}`,
      containerInsights: isProd,
    });

    // Create Task Execution Role
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    executionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    );

    // Create Task Role with permissions to access DynamoDB
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant permissions to DynamoDB tables
    productsTable.grantReadWriteData(taskRole);
    transactionsTable.grantReadWriteData(taskRole);

    // Create Log Group for container logs
    const logGroup = new logs.LogGroup(this, 'PosServiceLogs', {
      logGroupName: `/ecs/pos-service-${environment}`,
      retention: isProd ? logs.RetentionDays.TWO_WEEKS : logs.RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create Fargate Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'PosTaskDef', {
      memoryLimitMiB: isProd ? 2048 : 1024,
      cpu: isProd ? 1024 : 512,
      executionRole: executionRole,
      taskRole: taskRole,
    });

    // Add container to task definition
    const container = taskDefinition.addContainer('PosApiContainer', {
      image: ecs.ContainerImage.fromEcrRepository(this.repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'pos-api',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: isProd ? 'production' : 'development',
        PRODUCTS_TABLE: productsTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        AWS_REGION: cdk.Stack.of(this).region,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget -q --spider http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort: 3000,
      hostPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create security group for the load balancer
    const lbSecurityGroup = new ec2.SecurityGroup(this, 'LBSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for POS API load balancer',
    });

    lbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from anywhere'
    );

    // Create security group for the Fargate service
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for POS API Fargate service',
    });

    // Allow traffic from the load balancer to the service
    serviceSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(lbSecurityGroup.securityGroupId),
      ec2.Port.tcp(3000),
      'Allow traffic from load balancer'
    );

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'PosLB', {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: lbSecurityGroup,
      loadBalancerName: `pos-lb-${environment}`.substring(0, 32), // ALB name has a 32 char limit
    });

    // Create target group
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'PosTargetGroup', {
      vpc: this.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
    });

    // Create listener
    const listener = this.loadBalancer.addListener('PosListener', {
      port: 80,
      defaultTargetGroups: [this.targetGroup],
    });

    // Create Fargate Service
    this.service = new ecs.FargateService(this, 'PosService', {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      desiredCount: isProd ? 2 : 1,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      assignPublicIp: false,
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(this.targetGroup);

    // Enable auto-scaling for production
    if (isProd) {
      const scaling = this.service.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });

      // Scale based on CPU utilization
      scaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Scale based on memory utilization
      scaling.scaleOnMemoryUtilization('MemoryScaling', {
        targetUtilizationPercent: 80,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Scale based on request count per target
      scaling.scaleOnRequestCount('RequestScaling', {
        requestsPerTarget: 1000,
        targetGroup: this.targetGroup,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }
  }
}