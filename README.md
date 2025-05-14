# aws-pos-pipeline

A serverless point of sale system built with AWS Fargate, DynamoDB, and React.

## Architecture

The POS system uses a modern serverless architecture:

- **Frontend**: React-based single-page application hosted on S3/CloudFront
- **Backend**: Node.js RESTful API running on AWS Fargate containers
- **Database**: Amazon DynamoDB for serverless data storage
- **Authentication**: Amazon Cognito for user management and authentication
- **DevOps**: AWS CDK for infrastructure as code with CI/CD pipelines

## Project Structure

```
pos-system/
├── cdk/                # Infrastructure as Code using AWS CDK
├── backend/            # Node.js backend service
├── frontend/           # React frontend application
├── scripts/            # Utility scripts
├── docs/               # Documentation
└── .github/            # GitHub workflows for CI/CD
```

## Getting Started

### Prerequisites

- AWS Account
- Node.js 16+
- Docker
- AWS CLI configured

### Local Development Setup

1. **Clone the Repository**

```bash
git clone https://github.com/your-org/pos-system.git
cd pos-system
```

2. **Set Up Infrastructure**

```bash
cd cdk
npm install
npm run cdk bootstrap
npm run deploy:dev
```

3. **Set Up Backend**

```bash
cd ../backend
npm install
# Create .env file with necessary environment variables
npm run dev
```

4. **Set Up Frontend**

```bash
cd ../frontend
npm install
# Create .env file with necessary environment variables
npm start
```

### Environment Variables

#### Backend

Create a `.env` file in the `backend` directory with the following variables:

```
NODE_ENV=development
AWS_REGION=us-east-1
PRODUCTS_TABLE=pos-products-dev
TRANSACTIONS_TABLE=pos-transactions-dev
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-client-id
```

#### Frontend

Create a `.env` file in the `frontend` directory with the following variables:

```
REACT_APP_API_URL=http://localhost:3000
```

## Deployment

The project uses GitHub Actions for continuous integration and deployment:

- `backend-ci.yml`: Tests, builds, and deploys the backend service to AWS Fargate
- `frontend-ci.yml`: Tests, builds, and deploys the frontend to S3/CloudFront
- `infrastructure-ci.yml`: Deploys infrastructure changes using AWS CDK

## Authentication

The system uses Amazon Cognito for authentication. Users are assigned roles:

- **Admin**: Full access to all features including user management
- **Manager**: Access to reports and limited product management
- **Cashier**: Access to the POS interface for processing sales

## Features

- **Product Management**: Add, edit, and delete products
- **Transaction Processing**: Process sales and record transactions
- **User Management**: Create and manage user accounts
- **Reporting**: Generate sales reports and analytics
- **Inventory Management**: Track product inventory

## Extending the System

### Adding ML/AI Capabilities

The system can be extended with ML/AI capabilities:

1. Create a SageMaker notebook instance for development
2. Use DynamoDB streams to trigger Lambda functions for real-time processing
3. Implement prediction models for demand forecasting
4. Integrate personalized recommendations
5. Add anomaly detection for fraud prevention

## License

This project is licensed under the MIT License - see the LICENSE file for details.
