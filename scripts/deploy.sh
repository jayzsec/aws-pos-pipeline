#!/bin/bash

# Deploy script for POS System
# Usage: ./deploy.sh [environment] [component]
# Example: ./deploy.sh dev backend

set -e  # Exit immediately if a command exits with a non-zero status

# Default values
ENVIRONMENT=${1:-dev}
COMPONENT=${2:-all}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if environment is valid
if [[ ! "$ENVIRONMENT" =~ ^(dev|stage|prod)$ ]]; then
    echo "Invalid environment. Must be one of: dev, stage, prod"
    exit 1
fi

# Check if component is valid
if [[ ! "$COMPONENT" =~ ^(all|infrastructure|backend|frontend)$ ]]; then
    echo "Invalid component. Must be one of: all, infrastructure, backend, frontend"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

# Deploy infrastructure
deploy_infrastructure() {
    echo "Deploying infrastructure for $ENVIRONMENT environment..."
    cd "$PROJECT_ROOT/cdk"
    npm ci
    npm run deploy:$ENVIRONMENT
    
    # Get outputs
    echo "Retrieving infrastructure outputs..."
    aws cloudformation describe-stacks --stack-name PosSystem-$ENVIRONMENT --query "Stacks[0].Outputs" --output json > "$SCRIPT_DIR/outputs-$ENVIRONMENT.json"
    
    echo "Infrastructure deployment completed."
}

# Deploy backend
deploy_backend() {
    echo "Deploying backend for $ENVIRONMENT environment..."
    
    # Get ECR repository URI
    if [ -f "$SCRIPT_DIR/outputs-$ENVIRONMENT.json" ]; then
        ECR_REPOSITORY=$(jq -r '.[] | select(.OutputKey=="ECRRepository") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
    else
        echo "Infrastructure outputs not found. Deploying infrastructure first..."
        deploy_infrastructure
        ECR_REPOSITORY=$(jq -r '.[] | select(.OutputKey=="ECRRepository") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
    fi
    
    # Build and push Docker image
    cd "$PROJECT_ROOT/backend"
    
    # Get AWS account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region)
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Build and tag the image
    docker build -t pos-backend:latest .
    docker tag pos-backend:latest $ECR_REPOSITORY:latest
    
    # Push the image
    docker push $ECR_REPOSITORY:latest
    
    echo "Backend deployment completed."
}

# Deploy frontend
deploy_frontend() {
    echo "Deploying frontend for $ENVIRONMENT environment..."
    
    # Get S3 bucket and CloudFront distribution ID
    if [ -f "$SCRIPT_DIR/outputs-$ENVIRONMENT.json" ]; then
        S3_BUCKET=$(jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
        CLOUDFRONT_DISTRIBUTION=$(jq -r '.[] | select(.OutputKey=="CloudFrontDomain") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
        API_ENDPOINT=$(jq -r '.[] | select(.OutputKey=="ApiEndpoint") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
    else
        echo "Infrastructure outputs not found. Deploying infrastructure first..."
        deploy_infrastructure
        S3_BUCKET=$(jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
        CLOUDFRONT_DISTRIBUTION=$(jq -r '.[] | select(.OutputKey=="CloudFrontDomain") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
        API_ENDPOINT=$(jq -r '.[] | select(.OutputKey=="ApiEndpoint") | .OutputValue' "$SCRIPT_DIR/outputs-$ENVIRONMENT.json")
    fi
    
    # Build frontend
    cd "$PROJECT_ROOT/frontend"
    npm ci
    npm run build
    
    # Generate config.json
    echo "Generating config.json..."
    echo "{
      \"apiEndpoint\": \"$API_ENDPOINT\",
      \"environment\": \"$ENVIRONMENT\",
      \"region\": \"$AWS_REGION\"
    }" > build/config.json
    
    # Deploy to S3
    echo "Syncing to S3 bucket $S3_BUCKET..."
    aws s3 sync build/ s3://$S3_BUCKET/ --delete
    
    # Invalidate CloudFront cache
    DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$CLOUDFRONT_DISTRIBUTION'].Id" --output text)
    
    if [ -n "$DISTRIBUTION_ID" ]; then
        echo "Invalidating CloudFront cache for distribution $DISTRIBUTION_ID..."
        aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
    else
        echo "CloudFront distribution not found. Skipping cache invalidation."
    fi
    
    echo "Frontend deployment completed."
}

# Deploy all components
deploy_all() {
    deploy_infrastructure
    deploy_backend
    deploy_frontend
}

# Main deployment logic
echo "Starting deployment for $ENVIRONMENT environment..."

case $COMPONENT in
    all)
        deploy_all
        ;;
    infrastructure)
        deploy_infrastructure
        ;;
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
esac

echo "Deployment completed successfully!"