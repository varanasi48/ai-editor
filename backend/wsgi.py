from main import app
import asyncio
from werkzeug.wrappers import Request, Response
import json
import tempfile
import os
from pdf_utils import extract_text_from_pdf

class FastAPIWSGIAdapter:
    def __init__(self, fastapi_app):
        self.fastapi_app = fastapi_app

    def add_cors_headers(self, response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response

    def handle_upload_pdf(self, request):
        try:
            # Check if file is in request
            if 'file' not in request.files:
                return {"error": "No file provided"}, 400
            
            file = request.files['file']
            if file.filename == '':
                return {"error": "No file selected"}, 400
            
            # Check file type
            if not file.filename.lower().endswith('.pdf'):
                return {"error": "Only PDF files are supported"}, 400
            
            # Save temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                file.save(temp_file.name)
                temp_file_path = temp_file.name
            
            # Extract text
            try:
                extracted_text = extract_text_from_pdf(temp_file_path)
                os.unlink(temp_file_path)  # Clean up
                
                if not extracted_text.strip():
                    return {"error": "No text could be extracted from the PDF"}, 400
                
                return {
                    "message": "File uploaded and processed successfully",
                    "filename": file.filename,
                    "text": extracted_text,
                    "text_length": len(extracted_text)
                }, 200
                
            except Exception as e:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                return {"error": f"Error processing PDF: {str(e)}"}, 500
                
        except Exception as e:
            return {"error": f"Upload failed: {str(e)}"}, 500

    def handle_analyze(self, request):
        try:
            data = request.get_json()
            if not data or 'text' not in data:
                return {"error": "No text provided for analysis"}, 400
            
            text = data['text']
            
            # Simple text analysis (since we don't have Mistral configured yet)
            suggestions = [
                {
                    "id": 1,
                    "type": "grammar",
                    "original": "example text",
                    "suggestion": "improved text",
                    "explanation": "Grammar improvement suggestion",
                    "confidence": 0.8
                }
            ]
            
            return {
                "suggestions": suggestions,
                "analysis_complete": True,
                "word_count": len(text.split()),
                "char_count": len(text)
            }, 200
            
        except Exception as e:
            return {"error": f"Analysis failed: {str(e)}"}, 500

    def __call__(self, environ, start_response):
        try:
            request = Request(environ)
            
            # Handle CORS preflight
            if request.method == 'OPTIONS':
                response = Response('', status=200, content_type='text/plain')
                response = self.add_cors_headers(response)
                return response(environ, start_response)
            
            # Handle root endpoint
            if request.path == '/' and request.method == 'GET':
                body = json.dumps({
                    "message": "AI Legal Document Editor API", 
                    "status": "running", 
                    "version": "1.0.0",
                    "endpoints": ["/upload-pdf", "/analyze", "/legal-advice", "/get-log", "/log-change"]
                })
                response = Response(body, content_type='application/json')
                response = self.add_cors_headers(response)
                return response(environ, start_response)
            
            # Handle upload-pdf endpoint
            elif request.path == '/upload-pdf' and request.method == 'POST':
                result, status_code = self.handle_upload_pdf(request)
                body = json.dumps(result)
                response = Response(body, status=status_code, content_type='application/json')
                response = self.add_cors_headers(response)
                return response(environ, start_response)
            
            # Handle analyze endpoint
            elif request.path == '/analyze' and request.method == 'POST':
                result, status_code = self.handle_analyze(request)
                body = json.dumps(result)
                response = Response(body, status=status_code, content_type='application/json')
                response = self.add_cors_headers(response)
                return response(environ, start_response)
            
            # Handle other endpoints with placeholder responses
            elif request.path in ['/legal-advice', '/get-log', '/log-change']:
                body = json.dumps({
                    "message": f"Endpoint {request.path} is available but requires full implementation",
                    "status": "placeholder"
                })
                response = Response(body, status=200, content_type='application/json')
                response = self.add_cors_headers(response)
                return response(environ, start_response)
            
            # 404 for unknown endpoints
            else:
                body = json.dumps({
                    "error": "Endpoint not found",
                    "path": request.path,
                    "method": request.method
                })
                response = Response(body, status=404, content_type='application/json')
                response = self.add_cors_headers(response)
                return response(environ, start_response)
            
        except Exception as e:
            body = json.dumps({"error": f"Server error: {str(e)}"})
            response = Response(body, status=500, content_type='application/json')
            response = self.add_cors_headers(response)
            return response(environ, start_response)

# For Zappa deployment
application = FastAPIWSGIAdapter(app)
