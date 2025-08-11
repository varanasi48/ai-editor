# AWS Complete Hosting Setup for insync-edits

## Architecture
- **Frontend**: AWS Amplify Hosting
- **Backend**: AWS App Runner
- **Database**: File-based storage (projects folder structure)
- **AI**: Mistral AI integration

## Deployment Steps

### 1. Frontend (AWS Amplify)
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Choose GitHub → Repository: `varanasi48/ai-editor`
4. Branch: `main`
5. Build settings: Use `amplify.yml` (auto-detected)
6. Advanced settings:
   - Build image: `Amazon Linux:2023`
   - Environment variables: None needed for frontend

### 2. Backend (AWS App Runner)
1. Go to [AWS App Runner Console](https://console.aws.amazon.com/apprunner/)
2. Click "Create service"
3. Source: Repository → GitHub → `varanasi48/ai-editor`
4. Branch: `main`
5. Build settings: Use `apprunner.yaml` (auto-detected)
6. Service configuration:
   - Service name: `insync-edits-backend`
   - Virtual CPU: 0.25 vCPU
   - Memory: 0.5 GB
   - Port: 8000
7. Environment variables:
   - `MISTRAL_API_KEY`: [Your Mistral AI API Key]
   - `PORT`: 8000

### 3. Connect Frontend to Backend
After deployment, update frontend environment variables in Amplify:
- `REACT_APP_API_URL`: [Your App Runner service URL]

## Expected URLs
- Frontend: `https://[branch].[app-id].amplifyapp.com`
- Backend: `https://[service-name].[region].awsapprunner.com`

## Features Included
- ✅ Document folder structure (projects/username/documentname)
- ✅ Activity logging system
- ✅ Modal log viewing
- ✅ Download functionality
- ✅ Complete insync-edits branding
- ✅ Enhanced AI suggestion engine

## Monitoring
- Amplify: Build logs and hosting metrics
- App Runner: Service logs and performance metrics
- CloudWatch: Centralized logging and monitoring
