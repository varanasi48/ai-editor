# AWS Lambda Serverless Deployment (FREE!)

## Architecture
- **Frontend**: AWS Amplify Hosting (FREE tier)
- **Backend**: AWS Lambda + API Gateway (FREE tier)
- **Storage**: AWS S3 (FREE tier)
- **AI**: Mistral AI integration

## Cost Breakdown (ALL FREE!)
- **Lambda**: 1M requests/month FREE
- **API Gateway**: 1M requests/month FREE  
- **S3**: 5GB storage FREE
- **Amplify**: 5GB storage + 15GB bandwidth FREE

## Deployment Steps

### 1. Install SAM CLI
```bash
# Install AWS SAM CLI
pip install aws-sam-cli
```

### 2. Deploy Backend (Lambda)
```bash
# Build and deploy
cd d:\ai-law
sam build
sam deploy --guided

# Follow prompts:
# - Stack name: insync-edits-backend
# - Region: us-east-1 (or your preferred region)
# - Mistral API Key: [your-key]
```

### 3. Deploy Frontend (Amplify)
1. Go to AWS Amplify Console
2. New app → GitHub → ai-editor
3. Add environment variable:
   - `REACT_APP_API_URL`: [Your Lambda API Gateway URL from sam deploy output]

## Benefits of Lambda
- ✅ **100% FREE** for your usage level
- ✅ **Auto-scaling** (0 to millions of requests)
- ✅ **No server management**
- ✅ **Pay per request** (not per hour)
- ✅ **S3 integration** for file storage
- ✅ **Built-in logging** with CloudWatch

## File Storage Strategy
- Projects folder → S3 bucket
- Activity logs → S3 objects
- Download functionality → S3 presigned URLs
