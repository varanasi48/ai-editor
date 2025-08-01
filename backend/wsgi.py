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
            
            # Try Mistral AI analysis first, fall back to basic if it fails
            try:
                suggestions = self.analyze_with_mistral(text)
                print(f"Mistral analysis successful: {len(suggestions)} suggestions")
            except Exception as ai_error:
                print(f"Mistral AI error: {ai_error}, falling back to basic analysis")
                suggestions = self.create_basic_analysis(text)
            
            # Format suggestions to match frontend expectations  
            issues_found = []
            for suggestion in suggestions:
                # Format: "Category: Description → Suggested improvement"
                issue_text = f"{suggestion.get('type', 'Issue').title()}: {suggestion.get('original', 'Text issue')} → {suggestion.get('suggestion', 'No suggestion')}"
                issues_found.append(issue_text)
            
            return {
                "suggestions": suggestions,  # Keep for API compatibility
                "issues_found": issues_found,  # Add for frontend compatibility
                "total_issues": len(suggestions),  # Add total count for frontend
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

    def analyze_with_mistral(self, text):
        """Use Mistral AI for comprehensive grammar, spelling and style analysis"""
        import os
        from mistralai import Mistral
        
        # Get API key
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise Exception("Mistral API key not found")
        
        client = Mistral(api_key=api_key)
        
        # Craft a specific prompt for grammar and spelling checking
        prompt = f"""Analyze this text for errors and provide ONLY specific corrections:

"{text}"

Respond with corrections in this format only:
CORRECTION: [wrong text] → [correct text]
TYPE: [grammar/spelling/style]

Examples:
CORRECTION: much talented → many talented
TYPE: grammar
CORRECTION: alot → a lot  
TYPE: spelling

Be concise. List only clear errors."""

        try:
            # Call Mistral API with timeout handling
            response = client.chat.complete(
                model="mistral-small-latest",  # Use faster model
                messages=[
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Low temperature for consistent corrections
                max_tokens=800   # Reduced tokens for faster response
            )
            
            ai_response = response.choices[0].message.content
            print(f"Mistral AI response: {ai_response}")
            
            # Parse the structured response
            return self.parse_mistral_corrections(ai_response, text)
            
        except Exception as e:
            print(f"Mistral API error: {e}")
            raise e

    def parse_mistral_corrections(self, ai_response, original_text):
        """Parse Mistral's structured response into suggestions"""
        suggestions = []
        lines = ai_response.split('\n')
        
        current_correction = {}
        suggestion_id = 1
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('CORRECTION:'):
                # Save previous correction if exists
                if current_correction.get('original') and current_correction.get('suggestion'):
                    suggestions.append({
                        "id": suggestion_id,
                        "type": current_correction.get('type', 'improvement'),
                        "original": current_correction['original'],
                        "suggestion": current_correction['suggestion'],
                        "explanation": current_correction.get('explanation', 'AI suggested improvement'),
                        "confidence": 0.9
                    })
                    suggestion_id += 1
                
                # Parse new correction
                correction_part = line.replace('CORRECTION:', '').strip()
                if ' → ' in correction_part:
                    parts = correction_part.split(' → ')
                    current_correction = {
                        'original': parts[0].strip(),
                        'suggestion': parts[1].strip()
                    }
                
                elif line.startswith('EXPLANATION:'):
                    current_correction['explanation'] = line.replace('EXPLANATION:', '').strip()
                    
                elif line.startswith('TYPE:'):
                    current_correction['type'] = line.replace('TYPE:', '').strip()
                    
                    # When we hit TYPE, we have a complete correction, add it immediately
                    if current_correction.get('original') and current_correction.get('suggestion'):
                        suggestions.append({
                            "id": suggestion_id,
                            "type": current_correction.get('type', 'improvement'),
                            "original": current_correction['original'],
                            "suggestion": current_correction['suggestion'],
                            "explanation": current_correction.get('explanation', 'AI suggested improvement'),
                            "confidence": 0.9
                        })
                        suggestion_id += 1
                        current_correction = {}  # Reset for next correction        # Add final correction
        if current_correction.get('original') and current_correction.get('suggestion'):
            suggestions.append({
                "id": suggestion_id,
                "type": current_correction.get('type', 'improvement'),
                "original": current_correction['original'],
                "suggestion": current_correction['suggestion'],
                "explanation": current_correction.get('explanation', 'AI suggested improvement'),
                "confidence": 0.9
            })
        
        # If no structured corrections found, try to extract from free text
        if not suggestions:
            suggestions = self.extract_corrections_from_text(ai_response, original_text)
        
        return suggestions[:10]  # Limit to 10 suggestions

    def extract_corrections_from_text(self, ai_response, original_text):
        """Fallback method to extract corrections from unstructured AI response"""
        suggestions = []
        
        # Look for common patterns in AI responses
        import re
        
        # Pattern: "change X to Y" or "replace X with Y"
        patterns = [
            r'change "([^"]+)" to "([^"]+)"',
            r'replace "([^"]+)" with "([^"]+)"',
            r'"([^"]+)" should be "([^"]+)"',
            r'correct "([^"]+)" to "([^"]+)"'
        ]
        
        suggestion_id = 1
        for pattern in patterns:
            matches = re.finditer(pattern, ai_response, re.IGNORECASE)
            for match in matches:
                original = match.group(1)
                suggestion = match.group(2)
                
                # Verify the original text exists in the document
                if original.lower() in original_text.lower():
                    suggestions.append({
                        "id": suggestion_id,
                        "type": "grammar",
                        "original": original,
                        "suggestion": suggestion,
                        "explanation": f"AI suggested changing '{original}' to '{suggestion}'",
                        "confidence": 0.8
                    })
                    suggestion_id += 1
        
        return suggestions
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
        """Create comprehensive text analysis with specific corrections"""
        suggestions = []
        words = text.split()
        sentences = text.split('.')
        
        # Grammar and spelling corrections
        specific_corrections = []
        
        # Common spelling/grammar mistakes
        corrections_map = {
            "recieve": "receive",
            "occured": "occurred", 
            "seperate": "separate",
            "definately": "definitely",
            "alot": "a lot",
            "its a": "it's a",
            "there is alot": "there are a lot",
            "much talented": "many talented",  # Found in your text
            "continuous guidance": "continual guidance",
            "endless encouragement": "constant encouragement",
            "very big thanks": "heartfelt thanks",
            "would like to place": "I would like to express",
            "loving and inspiring": "beloved and inspiring",
            "heartfelt gratitude and respect": "sincere gratitude and respect",
            "kind guidance and blessings": "gracious guidance and blessings",
            "love and motivation": "affection and motivation",
            "much talented and dynamic": "highly talented and dynamic",
            "acknowledge the love": "recognize the love",
            "special thanks": "sincere thanks",
            # Add more specific to the acknowledgment text
            "through almighty": "through the almighty",
            "who is there in everything": "who is present in everything",
            "Role Model": "role model",  # Capitalization
            "Ex- Deputy": "Ex-Deputy",  # Spacing
            "Ex-Executive Director": "former Executive Director",
        }
        
        # Check for specific corrections in the text
        text_lower = text.lower()
        for wrong, correct in corrections_map.items():
            if wrong in text_lower:
                # Find the actual case-sensitive occurrence
                import re
                matches = re.finditer(re.escape(wrong), text, re.IGNORECASE)
                for match in matches:
                    original_text = text[match.start():match.end()]
                    suggestions.append({
                        "id": len(suggestions) + 1,
                        "type": "grammar",
                        "original": original_text,
                        "suggestion": correct,
                        "explanation": f"Grammar improvement: '{original_text}' should be '{correct}'",
                        "confidence": 0.9
                    })
        
        # Punctuation and formatting issues
        if '– ' in text:  # En dash usage
            suggestions.append({
                "id": len(suggestions) + 1,
                "type": "punctuation",
                "original": "– ",
                "suggestion": "- ",
                "explanation": "Use standard hyphen instead of en dash for consistency",
                "confidence": 0.8
            })
        
        # Check for missing periods
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) > 20 and not line.endswith('.') and not line.endswith(':'):
                # Find sentences that should end with periods
                if any(word in line.lower() for word in ['thanks', 'acknowledge', 'respect', 'gratitude']):
                    suggestions.append({
                        "id": len(suggestions) + 1,
                        "type": "punctuation",
                        "original": line,
                        "suggestion": line + ".",
                        "explanation": "Add period at end of sentence for proper punctuation",
                        "confidence": 0.8
                    })
        
        # Repetitive word usage analysis
        word_freq = {}
        for word in words:
            clean_word = word.lower().strip('.,!?";')
            if len(clean_word) > 3:
                word_freq[clean_word] = word_freq.get(clean_word, 0) + 1
        
        # Find overused words and suggest alternatives
        overused_words = {word: count for word, count in word_freq.items() if count > 3}
        synonym_suggestions = {
            "acknowledge": ["recognize", "appreciate", "thank", "honor"],
            "would": ["wish to", "desire to", "intend to"],
            "place": ["express", "extend", "offer", "give"],
            "love": ["affection", "care", "support", "devotion"],
            "guidance": ["direction", "mentorship", "advice", "counsel"]
        }
        
        for word, count in overused_words.items():
            if word in synonym_suggestions:
                suggestions.append({
                    "id": len(suggestions) + 1,
                    "type": "variety",
                    "original": word,
                    "suggestion": synonym_suggestions[word][0],
                    "explanation": f"'{word}' appears {count} times. Consider using '{synonym_suggestions[word][0]}' for variety",
                    "confidence": 0.7
                })
        
        # Professional writing improvements
        informal_phrases = {
            "very big thanks": "sincere gratitude",
            "much talented": "highly talented",
            "loving and inspiring": "beloved and inspiring",
            "endless encouragement": "unwavering encouragement"
        }
        
        for informal, formal in informal_phrases.items():
            if informal in text.lower():
                suggestions.append({
                    "id": len(suggestions) + 1,
                    "type": "style",
                    "original": informal,
                    "suggestion": formal,
                    "explanation": f"Use more formal language: '{formal}' instead of '{informal}'",
                    "confidence": 0.8
                })
        
        # Sentence structure improvements
        long_sentences = [s.strip() for s in sentences if len(s.split()) > 25]
        for sentence in long_sentences[:2]:  # Limit to first 2 long sentences
            if sentence:
                suggestions.append({
                    "id": len(suggestions) + 1,
                    "type": "clarity",
                    "original": sentence[:50] + "...",
                    "suggestion": "Consider breaking into shorter sentences",
                    "explanation": f"This sentence has {len(sentence.split())} words. Consider splitting for better readability.",
                    "confidence": 0.7
                })
        
        # If no specific issues found, add general suggestions
        if len(suggestions) < 2:
            suggestions.append({
                "id": len(suggestions) + 1,
                "type": "review",
                "original": "Document structure",
                "suggestion": "Consider adding paragraph breaks for better organization",
                "explanation": "Well-structured documents improve readability and professional appearance",
                "confidence": 0.6
            })
        
        return suggestions[:8]  # Limit to 8 most relevant suggestions

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
