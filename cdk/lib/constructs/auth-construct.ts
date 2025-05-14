import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthConstructProps {
  environment: string;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const { environment } = props;
    const isProd = environment === 'prod';

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `pos-user-pool-${environment}`,
      selfSignUpEnabled: false, // Only admins can create users
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
        email: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }), // admin, cashier, etc.
        employeeId: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: !isProd, // More strict for production
        tempPasswordValidity: cdk.Duration.days(isProd ? 1 : 7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `pos-client-${environment}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(isProd ? 1 : 30),
      accessTokenValidity: cdk.Duration.minutes(isProd ? 60 : 240),
      idTokenValidity: cdk.Duration.minutes(isProd ? 60 : 240),
      enableTokenRevocation: true,
    });

    // Create app client domain for hosted UI (optional)
    if (isProd) {
      const domain = this.userPool.addDomain('UserPoolDomain', {
        cognitoDomain: {
          domainPrefix: `pos-system-${environment}`,
        },
      });
    }
  }
}