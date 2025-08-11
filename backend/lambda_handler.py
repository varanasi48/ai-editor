import json
import boto3
import os
from mangum import Mangum
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Import your existing FastAPI app
from main import app

# S3 client for file storage
s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'insync-edits-storage')

# Wrap FastAPI app for Lambda
handler = Mangum(app)
