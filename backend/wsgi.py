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
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '86400'
        response.headers['Access-Control-Allow-Credentials'] = 'false'
        return response

    def handle_upload_pdf(self, request):
        try:
            # Parse multipart form data correctly
            from werkzeug.formparser import parse_form_data
            
            # Parse the form data - handle all return values
            stream, form, files = parse_form_data(request.environ)
            
            # Check if file is provided
            if 'file' not in files:
                return {"error": "No file provided"}, 400
            
            file = files['file']
            if not file.filename or file.filename == '':
                return {"error": "No file selected"}, 400
            
            # Debug: log the filename and allow PDF and DOCX files
            print(f"Received file: {file.filename}")
            
            # Check file type - support both PDF and DOCX
            filename_lower = file.filename.lower()
            if not (filename_lower.endswith('.pdf') or filename_lower.endswith('.docx') or filename_lower.endswith('.doc')):
                return {"error": f"Only PDF and DOCX files are supported. Received: {file.filename}"}, 400
            
            # Save temporary file
            import tempfile
            import os
            from pdf_utils import extract_text_from_pdf
            from docx_utils import extract_text_from_docx
            
            # Determine file extension
            file_extension = '.pdf'  # default
            if file.filename and '.' in file.filename:
                file_extension = '.' + file.filename.split('.')[-1].lower()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                # Read the file content and write to temp file
                file_content = file.read()
                temp_file.write(file_content)
                temp_file.flush()
                temp_file_path = temp_file.name
            
            # Extract text based on file type
            try:
                if file_extension == '.pdf':
                    extracted_text = extract_text_from_pdf(temp_file_path)
                elif file_extension in ['.docx', '.doc']:
                    extracted_text = extract_text_from_docx(temp_file_path)
                else:
                    # For other files, try to read as text
                    with open(temp_file_path, 'r', encoding='utf-8') as f:
                        extracted_text = f.read()
                
                os.unlink(temp_file_path)  # Clean up
                
                if not extracted_text.strip():
                    return {"error": "No text could be extracted from the file"}, 400
                
                return {
                    "message": "File uploaded and processed successfully",
                    "filename": file.filename,
                    "text": extracted_text,
                    "text_length": len(extracted_text),
                    "file_type": file_extension
                }, 200
                
            except Exception as e:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                return {"error": f"Error processing file: {str(e)}"}, 500
                
        except Exception as e:
            return {"error": f"Upload failed: {str(e)}"}, 500

    def handle_analyze(self, request):
        try:
            # Debug: Print what we received
            print(f"Analyze request method: {request.method}")
            print(f"Analyze request headers: {dict(request.headers)}")
            
            # Handle JSON parsing more robustly
            try:
                data = request.get_json()
            except Exception as json_error:
                print(f"JSON parsing error: {json_error}")
                return {"error": "Invalid JSON in request body"}, 400
                
            print(f"Analyze request data: {data}")
            
            if not data or 'text' not in data:
                return {"error": "No text provided for analysis"}, 400
            
            text = data['text']
            print(f"Text length received: {len(text) if text else 0}")
            
            if not text or len(text.strip()) == 0:
                return {"error": "Empty text provided"}, 400
            
            # Use basic analysis for now to avoid AI errors
            suggestions = self.create_basic_analysis(text)
            return {
                "suggestions": suggestions,
                "analysis_complete": True,
                "word_count": len(text.split()),
                "char_count": len(text),
                "highlighted_text": text,  # Add this field for frontend compatibility
                "original_text": text
            }, 200
            
        except Exception as e:
            print(f"Analysis error: {e}")
            return {
                "error": "Analysis failed",
                "details": str(e),
                "suggestions": [{
                    "id": 1,
                    "type": "error",
                    "original": "Analysis error",
                    "suggestion": "Please try again",
                    "explanation": "There was an error processing your request",
                    "confidence": 0.0
                }],
                "analysis_complete": False,
                "word_count": 0,
                "char_count": 0,
                "highlighted_text": text if 'text' in locals() else "",  # Preserve text even on error
                "original_text": text if 'text' in locals() else ""
            }, 500

    def parse_mistral_suggestions(self, ai_response, original_text):
        """Parse Mistral AI response into structured suggestions"""
        suggestions = []
        suggestion_id = 1
        
        # Simple parsing - in a real implementation, you might use more sophisticated NLP
        lines = ai_response.split('\n')
        current_suggestion = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Look for common patterns in AI responses
            if any(keyword in line.lower() for keyword in ['suggest', 'improve', 'change', 'replace', 'consider']):
                if current_suggestion:
                    # Finalize previous suggestion
                    suggestions.append({
                        "id": suggestion_id,
                        "type": current_suggestion.get("type", "improvement"),
                        "original": current_suggestion.get("original", "Text section"),
                        "suggestion": current_suggestion.get("suggestion", line),
                        "explanation": current_suggestion.get("explanation", "AI suggested improvement"),
                        "confidence": current_suggestion.get("confidence", 0.7)
                    })
                    suggestion_id += 1
                
                # Start new suggestion
                current_suggestion = {
                    "suggestion": line,
                    "type": "improvement",
                    "confidence": 0.7
                }
            
            elif "grammar" in line.lower():
                current_suggestion["type"] = "grammar"
            elif "legal" in line.lower():
                current_suggestion["type"] = "legal"
            elif "clarity" in line.lower() or "readable" in line.lower():
                current_suggestion["type"] = "clarity"
            elif "structure" in line.lower():
                current_suggestion["type"] = "structure"
            
            # Extract explanations
            if line.startswith("Explanation:") or "because" in line.lower() or "reason" in line.lower():
                current_suggestion["explanation"] = line
        
        # Add final suggestion if exists
        if current_suggestion:
            suggestions.append({
                "id": suggestion_id,
                "type": current_suggestion.get("type", "improvement"),
                "original": current_suggestion.get("original", "Document section"),
                "suggestion": current_suggestion.get("suggestion", "See AI analysis"),
                "explanation": current_suggestion.get("explanation", "AI suggested improvement"),
                "confidence": current_suggestion.get("confidence", 0.7)
            })
        
        # If no suggestions were parsed, create a general one
        if not suggestions:
            suggestions.append({
                "id": 1,
                "type": "analysis",
                "original": "Document analysis",
                "suggestion": ai_response[:200] + "..." if len(ai_response) > 200 else ai_response,
                "explanation": "Complete AI analysis of the document",
                "confidence": 0.8
            })
        
        return suggestions[:10]  # Limit to 10 suggestions

    def create_basic_analysis(self, text):
        """Create basic text analysis without AI"""
        suggestions = []
        words = text.split()
        sentences = text.split('.')
        
        # Basic statistics-based suggestions
        if len(words) < 50:
            suggestions.append({
                "id": 1,
                "type": "length",
                "original": "Document length",
                "suggestion": "Consider expanding the document with more detailed information",
                "explanation": f"Document has only {len(words)} words. Legal documents typically benefit from more comprehensive coverage.",
                "confidence": 0.8
            })
        
        # Check for common issues
        if text.count('!') > 3:
            suggestions.append({
                "id": len(suggestions) + 1,
                "type": "style",
                "original": "Excessive exclamation marks",
                "suggestion": "Use periods instead of exclamation marks for professional tone",
                "explanation": "Legal documents should maintain a formal, professional tone",
                "confidence": 0.9
            })
        
        # Check sentence length
        long_sentences = [s for s in sentences if len(s.split()) > 30]
        if long_sentences:
            suggestions.append({
                "id": len(suggestions) + 1,
                "type": "clarity",
                "original": "Long sentences detected",
                "suggestion": "Consider breaking long sentences into shorter, clearer statements",
                "explanation": f"Found {len(long_sentences)} sentences with over 30 words. Shorter sentences improve readability.",
                "confidence": 0.7
            })
        
        # Basic legal terminology check
        legal_terms = ['shall', 'whereas', 'hereby', 'therefore', 'pursuant']
        found_terms = [term for term in legal_terms if term.lower() in text.lower()]
        if not found_terms and len(words) > 100:
            suggestions.append({
                "id": len(suggestions) + 1,
                "type": "legal",
                "original": "Legal terminology",
                "suggestion": "Consider using appropriate legal terminology for formal documents",
                "explanation": "Legal documents typically use formal language and specific terminology",
                "confidence": 0.6
            })
        
        # Default suggestion if none found
        if not suggestions:
            suggestions.append({
                "id": 1,
                "type": "analysis",
                "original": "Document review",
                "suggestion": "Document appears well-structured",
                "explanation": "No major issues detected in basic analysis. Consider AI analysis for detailed review.",
                "confidence": 0.5
            })
        
        return suggestions

    def __call__(self, environ, start_response):
        try:
            request = Request(environ)
            
            # Handle CORS preflight
            if request.method == 'OPTIONS':
                response = Response('', status=200, content_type='text/plain')
                response.headers['Access-Control-Allow-Origin'] = '*'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, Origin, X-Requested-With'
                response.headers['Access-Control-Max-Age'] = '86400'
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
                try:
                    result, status_code = self.handle_analyze(request)
                    body = json.dumps(result)
                    response = Response(body, status=status_code, content_type='application/json')
                    response = self.add_cors_headers(response)
                    return response(environ, start_response)
                except Exception as analyze_error:
                    # Ensure CORS headers even on error
                    error_body = json.dumps({
                        "error": "Analysis failed", 
                        "details": str(analyze_error)
                    })
                    response = Response(error_body, status=500, content_type='application/json')
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
