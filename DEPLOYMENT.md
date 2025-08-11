# Fresh Deployment - Insync Edits

## Frontend (React)
- Build: `npm run build` in frontend folder
- Deploy to: New Amplify app or Netlify/Vercel

## Backend (FastAPI) 
- Deploy to: AWS App Runner or Railway
- Environment: MISTRAL_API_KEY required

## Features
- Document folder structure: projects/username/documentname
- Activity logging system
- Modal log viewing
- Download functionality
- Complete insync-edits branding

## Deployment Commands
```bash
# Frontend build
cd frontend && npm run build

# Backend start
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
```
