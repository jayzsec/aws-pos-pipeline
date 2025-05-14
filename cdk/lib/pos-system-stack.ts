import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/database-construct';
import { ApiConstruct } from './constructs/api-construct';
import { FrontendConstruct } from './constructs/frontend-construct';
import { AuthConstruct } from './constructs/auth-construct';
import * as alarms from './monitoring/alarms';

export interface PosSystemStackProps extends cdk.StackProps {
  environment: string;
}

export class PosSystemStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PosSystemStackProps) {
    super(scope, id, props);

    // Get environment configuration
    const { environment } = props;
    const isProd = environment === 'prod';

    // Create authentication resources
    const auth = new AuthConstruct(this, 'Auth', {
      environment: environment
    });

    // Create database resources
    const database = new DatabaseConstruct(this, 'Database', {
      environment: environment
    });

    // Create API and Fargate resources
    const api = new ApiConstruct(this, 'Api', {
      environment: environment,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      productsTable: database.productsTable,
      transactionsTable: database.transactionsTable
    });

    // Create frontend resources
    const frontend = new FrontendConstruct(this, 'Frontend', {
      environment: environment,
      apiEndpoint: api.loadBalancer.loadBalancerDnsName
    });

    // Set up monitoring alarms for production
    if (isProd) {
      alarms.setupAlarms(this, {
        environment: environment,
        cluster: api.cluster,
        service: api.service,
        loadBalancer: api.loadBalancer,
        targetGroup: api.targetGroup
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: `http://${api.loadBalancer.loadBalancerDnsName}`,
      description: 'API endpoint URL',
    });

    new cdk.CfnOutput(this, 'FrontendURL', {
      value: `https://${frontend.distribution.distributionDomainName}`,
      description: 'Frontend URL',
    });

    new cdk.CfnOutput(this, 'ECRRepository', {
      value: api.repository.repositoryUri,
      description: 'ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: auth.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: auth.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'ProductsTableName', {
      value: database.productsTable.tableName,
      description: 'DynamoDB Products Table Name',
    });

    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: database.transactionsTable.tableName,
      description: 'DynamoDB Transactions Table Name',
    });
  }
}