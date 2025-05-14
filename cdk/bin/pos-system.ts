#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PosSystemStack } from '../lib/pos-system-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

// Create stack with the appropriate environment
new PosSystemStack(app, `PosSystem-${environment}`, {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
  },
  environment: environment,
  tags: {
    Environment: environment,
    Project: 'POS-System',
    ManagedBy: 'CDK'
  }
});