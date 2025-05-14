import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface AlarmsConfig {
  environment: string;
  cluster: ecs.Cluster;
  service: ecs.FargateService;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  targetGroup: elbv2.ApplicationTargetGroup;
  alarmEmail?: string;
}

export function setupAlarms(scope: cdk.Stack, config: AlarmsConfig) {
  const {
    environment,
    cluster,
    service,
    loadBalancer,
    targetGroup,
    alarmEmail = 'alerts@example.com', // Default alert email
  } = config;

  // Create an SNS topic for alarms
  const alarmTopic = new sns.Topic(scope, 'PosAlarmTopic', {
    topicName: `pos-alarms-${environment}`,
    displayName: `POS System Alarms (${environment})`,
  });

  // Add email subscription if in production
  if (environment === 'prod' && alarmEmail) {
    alarmTopic.addSubscription(new subscriptions.EmailSubscription(alarmEmail));
  }

  // CPU Utilization alarm
  const cpuAlarm = new cloudwatch.Alarm(scope, 'CpuUtilizationAlarm', {
    alarmName: `pos-cpu-alarm-${environment}`,
    alarmDescription: 'Alarm when CPU utilization exceeds 80% for 5 minutes',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        ClusterName: cluster.clusterName,
        ServiceName: service.serviceName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    }),
    threshold: 80,
    evaluationPeriods: 5,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  cpuAlarm.addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

  // Memory Utilization alarm
  const memoryAlarm = new cloudwatch.Alarm(scope, 'MemoryUtilizationAlarm', {
    alarmName: `pos-memory-alarm-${environment}`,
    alarmDescription: 'Alarm when memory utilization exceeds 80% for 5 minutes',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      dimensionsMap: {
        ClusterName: cluster.clusterName,
        ServiceName: service.serviceName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    }),
    threshold: 80,
    evaluationPeriods: 5,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  memoryAlarm.addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

  // 5XX Error Rate alarm
  const error5xxAlarm = new cloudwatch.Alarm(scope, 'Http5xxErrorAlarm', {
    alarmName: `pos-5xx-alarm-${environment}`,
    alarmDescription: 'Alarm when 5XX errors exceed threshold',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_5XX_Count',
      dimensionsMap: {
        LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
        TargetGroup: targetGroup.targetGroupFullName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    }),
    threshold: 10,
    evaluationPeriods: 5,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  error5xxAlarm.addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

  // High Target Response Time alarm
  const responseTimeAlarm = new cloudwatch.Alarm(scope, 'ResponseTimeAlarm', {
    alarmName: `pos-response-time-alarm-${environment}`,
    alarmDescription: 'Alarm when target response time exceeds 2 seconds for 5 minutes',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetResponseTime',
      dimensionsMap: {
        LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
        TargetGroup: targetGroup.targetGroupFullName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    }),
    threshold: 2, // 2 seconds
    evaluationPeriods: 5,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  responseTimeAlarm.addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

  // Target Health alarm
  const unhealthyTargetsAlarm = new cloudwatch.Alarm(scope, 'UnhealthyTargetsAlarm', {
    alarmName: `pos-unhealthy-targets-alarm-${environment}`,
    alarmDescription: 'Alarm when there are unhealthy targets',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'UnHealthyHostCount',
      dimensionsMap: {
        LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
        TargetGroup: targetGroup.targetGroupFullName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    }),
    threshold: 1,
    evaluationPeriods: 5,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  unhealthyTargetsAlarm.addAlarmAction(new cloudwatch.SnsAction(alarmTopic));

  // Create a dashboard for monitoring
  const dashboard = new cloudwatch.Dashboard(scope, 'PosDashboard', {
    dashboardName: `pos-dashboard-${environment}`,
  });

  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      title: 'CPU and Memory Utilization',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ClusterName: cluster.clusterName,
            ServiceName: service.serviceName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(1),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: {
            ClusterName: cluster.clusterName,
            ServiceName: service.serviceName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(1),
        }),
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'Request Count and Response Time',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'RequestCount',
          dimensionsMap: {
            LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
            TargetGroup: targetGroup.targetGroupFullName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensionsMap: {
            LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
            TargetGroup: targetGroup.targetGroupFullName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(1),
        }),
      ],
    }),
    new cloudwatch.GraphWidget({
      title: 'HTTP Errors',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_Target_4XX_Count',
          dimensionsMap: {
            LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
            TargetGroup: targetGroup.targetGroupFullName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'HTTPCode_Target_5XX_Count',
          dimensionsMap: {
            LoadBalancer: cdk.Fn.getAtt(loadBalancer.node.defaultChild as cdk.CfnElement, 'LoadBalancerFullName').toString(),
            TargetGroup: targetGroup.targetGroupFullName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
      ],
    })
  );

  return {
    alarmTopic,
    dashboard,
  };
}