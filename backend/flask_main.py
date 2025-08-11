from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import json
import tempfile
import os
from datetime import datetime
from pdf_utils import extract_text_from_pdf
try:
    from docx_utils import extract_text_from_docx
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False
    def extract_text_from_docx(file_path):
        return "DOCX processing is temporarily unavailable. Please use PDF format."
import tempfile
import os
from mistralai import Mistral
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Mistral client
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "your-mistral-api-key-here")
mistral_client = None

try:
    if MISTRAL_API_KEY and MISTRAL_API_KEY != "your-mistral-api-key-here":
        mistral_client = Mistral(api_key=MISTRAL_API_KEY)
        print("Mistral AI client initialized successfully")
    else:
        print("Mistral API key not found. Legal advice feature will be disabled.")
except Exception as e:
    print(f"Failed to initialize Mistral client: {e}")

@app.route('/')
def root():
    return jsonify({"message": "AI Legal Document Editor API", "status": "running", "version": "1.0.0"})

@app.route('/analyze', methods=['POST'])
def analyze_text():
    data = request.get_json()
    text = data.get('text', '')
    custom_prompt = data.get('custom_prompt', '')
    username = data.get('username', 'anonymous')
    document_name = data.get('document_name', '')
    
    print(f"Received text: {text[:100]}...")  # Debug print (first 100 chars)
    print(f"Custom prompt: {custom_prompt}")  # Debug print

    # Log the analysis request if document info is provided
    if username != "anonymous" and document_name:
        try:
            user_projects_dir = os.path.join("projects", username)
            document_folder = os.path.join(user_projects_dir, document_name)
            if os.path.exists(document_folder):
                log_file_path = os.path.join(document_folder, f"{document_name}_activity.log")
                log_entry = f"[{datetime.now().isoformat()}] ANALYZE - Document analyzed with prompt: '{custom_prompt}' (User: {username})\n"
                with open(log_file_path, "a", encoding="utf-8") as log_file:
                    log_file.write(log_entry)
        except Exception as e:
            print(f"Error logging analysis: {e}")

    if not mistral_client:
        # Fallback analysis without AI
        suggestions = []
        
        # Basic grammar checks
        if re.search(r'\s+([.!?])', text):
            suggestions.append({
                "type": "spacing",
                "message": "Remove space before punctuation",
                "original": re.search(r'\s+([.!?])', text).group(),
                "suggestion": re.search(r'\s+([.!?])', text).group(1)
            })
        
        # Check for double spaces
        if '  ' in text:
            suggestions.append({
                "type": "spacing",
                "message": "Multiple spaces found - use single space",
                "original": "  ",
                "suggestion": " "
            })
        
        # Check for missing capitalization after periods
        period_lower = re.findall(r'\.\s+[a-z]', text)
        if period_lower:
            suggestions.append({
                "type": "capitalization",
                "message": "Capitalize first letter after period",
                "original": period_lower[0],
                "suggestion": period_lower[0][:-1] + period_lower[0][-1].upper()
            })
        
        return jsonify({
            "suggestions": suggestions,
            "enhanced_suggestions": [],
            "word_count": len(text.split()),
            "character_count": len(text),
            "status": "analysis_complete_basic"
        })

    try:
        # Create the prompt based on whether custom prompt is provided
        if custom_prompt:
            system_prompt = f"""You are an AI assistant helping with document analysis. The user has provided this specific request: "{custom_prompt}"

Please analyze the text and provide suggestions based on the user's request. Format your response as JSON with this structure:
{{
    "suggestions": [
        {{
            "type": "category",
            "message": "description",
            "original": "original text",
            "suggestion": "improved text"
        }}
    ],
    "enhanced_suggestions": [
        {{
            "category": "Grammar/Style/Legal/etc",
            "issue": "specific issue found",
            "suggestion": "how to improve",
            "confidence": "high/medium/low"
        }}
    ]
}}"""
        else:
            system_prompt = """You are a professional legal document editor and proofreader. Analyze the provided text for:

1. Grammar and spelling errors
2. Punctuation mistakes
3. Style improvements
4. Legal terminology accuracy
5. Sentence structure and clarity
6. Formatting consistency

Provide specific suggestions for improvement. Format your response as JSON with this structure:
{
    "suggestions": [
        {
            "type": "grammar/spelling/punctuation/style",
            "message": "description of the issue",
            "original": "original text that needs fixing",
            "suggestion": "corrected version"
        }
    ],
    "enhanced_suggestions": [
        {
            "category": "Grammar/Style/Legal/Clarity",
            "issue": "specific issue found",
            "suggestion": "detailed suggestion for improvement",
            "confidence": "high/medium/low"
        }
    ]
}"""

        response = mistral_client.chat.complete(
            model="mistral-large-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            max_tokens=2000
        )
        
        ai_response = response.choices[0].message.content
        print(f"AI Response: {ai_response}")  # Debug print
        
        # Try to parse the JSON response
        try:
            ai_suggestions = json.loads(ai_response)
            return jsonify({
                "suggestions": ai_suggestions.get("suggestions", []),
                "enhanced_suggestions": ai_suggestions.get("enhanced_suggestions", []),
                "word_count": len(text.split()),
                "character_count": len(text),
                "status": "analysis_complete"
            })
        except json.JSONDecodeError:
            # If JSON parsing fails, return the raw response
            return jsonify({
                "suggestions": [],
                "enhanced_suggestions": [
                    {
                        "category": "AI Analysis",
                        "issue": "Raw AI feedback",
                        "suggestion": ai_response,
                        "confidence": "medium"
                    }
                ],
                "word_count": len(text.split()),
                "character_count": len(text),
                "status": "analysis_complete_raw"
            })
            
    except Exception as e:
        print(f"Error with Mistral API: {e}")
        return jsonify({
            "error": f"AI analysis failed: {str(e)}",
            "suggestions": [],
            "enhanced_suggestions": [],
            "word_count": len(text.split()),
            "character_count": len(text),
            "status": "analysis_failed"
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
