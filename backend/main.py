from fastapi import FastAPI, Request, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
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

app = FastAPI()

# Initialize Mistral client (you'll need to set your API key)
# For now, we'll use a placeholder - you should set this as an environment variable
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "AI Legal Document Editor API", "status": "running", "version": "1.0.0"}

class AnalyzeRequest(BaseModel):
    text: str

class LegalAdviceRequest(BaseModel):
    text: str
    question: str = "Please provide legal analysis and suggestions for this document."

class LogChangeRequest(BaseModel):
    category: str
    original_text: str
    suggested_text: str
    document_name: str
    timestamp: str

@app.post("/analyze")
async def analyze_text(payload: AnalyzeRequest):
    text = payload.text
    print(f"Received text: {text[:100]}...")  # Debug print (first 100 chars)

    if not mistral_client:
        # Fallback to rule-based analysis if Mistral is not available
        return fallback_rule_based_analysis(text)
    
    try:
        # Use Mistral AI for intelligent document analysis
        system_prompt = """You are an expert legal document analyzer. Analyze the provided legal document and identify specific issues that need correction. For each issue you find, provide:

1. The exact text that needs to be changed
2. The suggested replacement
3. The category of the issue (Spelling, Grammar, Style, Legal terminology, etc.)

Format your response as a JSON object with this structure:
{
  "issues": [
    {
      "category": "Spelling",
      "original_text": "wheras",
      "suggested_text": "whereas",
      "explanation": "Correct spelling of 'whereas'"
    },
    {
      "category": "Legal terminology", 
      "original_text": "according to",
      "suggested_text": "pursuant to",
      "explanation": "More formal legal terminology"
    }
  ]
}

Focus on:
- Spelling and grammar errors
- Informal language that should be more formal
- Legal terminology improvements
- Clarity and precision issues
- Style consistency

Only identify issues where you can provide a specific text replacement. Do not include general advice or structural suggestions."""

        user_prompt = f"Please analyze this legal document and identify specific text corrections:\n\n{text}"
        
        # Call Mistral AI
        response = mistral_client.chat.complete(
            model="mistral-large-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={
                "type": "json_object"
            }
        )
        
        ai_response = response.choices[0].message.content
        print(f"AI Response: {ai_response}")  # Debug print
        
        # Parse the AI response
        import json
        try:
            ai_data = json.loads(ai_response)
            issues = ai_data.get("issues", [])
        except json.JSONDecodeError:
            print("Failed to parse AI response as JSON, falling back to rule-based analysis")
            return fallback_rule_based_analysis(text)
        
        # Process the AI suggestions and create highlighted text
        highlighted = text
        issues_found = []
        
        # Don't sort issues - keep original order to maintain index consistency
        # (Sorting would break the index mapping between frontend and backend)
        
        for issue_index, issue in enumerate(issues):
            original = issue.get("original_text", "")
            suggested = issue.get("suggested_text", "")
            category = issue.get("category", "Issue")
            explanation = issue.get("explanation", "")
            
            if original and suggested:
                # Create issue entry in the expected format
                issues_found.append(f"{category}: {original} → {suggested}")
                
                # Create highlight based on category
                if category.lower() == "spelling":
                    highlight_style = "background-color: #ffe0e0; color: #a00;"
                elif category.lower() == "grammar":
                    highlight_style = "background-color: #d4edda; color: #155724;"
                elif category.lower() == "style":
                    highlight_style = "background-color: #fff3cd; color: #856404;"
                elif "legal" in category.lower():
                    highlight_style = "background-color: #e2e3f0; color: #383d41;"
                else:
                    highlight_style = "background-color: #f8f9fa; color: #495057;"
                
                # Replace text with highlighted version (case-sensitive first, then case-insensitive)
                import re
                pattern = re.compile(re.escape(original), re.IGNORECASE)
                if pattern.search(highlighted):
                    highlighted = pattern.sub(
                        f"<span style='{highlight_style}' title='{category}: {explanation}' data-issue-index='{issue_index}'>{original}</span>",
                        highlighted,
                        count=1  # Only replace first occurrence to avoid conflicts
                    )
        
        print(f"Final highlighted text: {highlighted[:200]}...")  # Debug print
        print(f"Issues found: {issues_found}")  # Debug print
        
        return {
            "highlighted_text": highlighted,
            "issues_found": issues_found,
            "total_issues": len(issues_found)
        }
        
    except Exception as e:
        print(f"Error with Mistral AI analysis: {e}")
        # Fallback to rule-based analysis
        return fallback_rule_based_analysis(text)

def fallback_rule_based_analysis(text):
    """Fallback function with the original rule-based analysis"""
    import re
    highlighted = text
    issues_found = []
    
    # 1. SPELLING ERRORS
    spelling_errors = {
        "wheras": "whereas",
        "herebye": "hereby",
        "aforementionedly": "aforementioned",
        "cuboard": "cupboard",
        "seperate": "separate",
        "recieve": "receive",
        "occured": "occurred",
        "judgement": "judgment",
        "priviledge": "privilege",
        "neccessary": "necessary",
        "occassion": "occasion",
        "beleive": "believe",
        "acheive": "achieve",
    }
    
    issue_index = 0
    for error, suggestion in spelling_errors.items():
        pattern = re.compile(rf"\b({error})\b", re.IGNORECASE)
        if pattern.search(highlighted):
            issues_found.append(f"Spelling: {error} → {suggestion}")
            highlighted = pattern.sub(
                rf"<span style='background-color: #ffe0e0; color: #a00;' title='Spelling error: Did you mean \"{suggestion}\"?' data-issue-index='{issue_index}'>\1</span>",
                highlighted,
            )
            issue_index += 1
    
    # 2. LEGAL WRITING STYLE ISSUES
    style_issues = {
        r"\bI think\b": ("I think", "I believe"),
        r"\bmight\b": ("might", "may"),
        r"\bkinda\b": ("kinda", "somewhat"),
        r"\bgonna\b": ("gonna", "going to"),
        r"\bwanna\b": ("wanna", "want to"),
        r"\bretty\b": ("pretty", "rather"),
        r"\bokay\b": ("okay", "acceptable"),
        r"\bOK\b": ("OK", "acceptable"),
    }
    
    for pattern_str, (error_word, suggestion) in style_issues.items():
        pattern = re.compile(pattern_str, re.IGNORECASE)
        matches = pattern.findall(highlighted)
        if matches:
            for match in matches:
                issues_found.append(f"Style: {match} → {suggestion}")
            highlighted = pattern.sub(
                rf"<span style='background-color: #fff3cd; color: #856404;' title='Style issue: Use \"{suggestion}\" instead' data-issue-index='{issue_index}'>\g<0></span>",
                highlighted,
            )
            issue_index += 1
    
    # 3. GRAMMAR AND PUNCTUATION
    grammar_issues = {
        r"\b(it's)\b(?=\s+(own|purpose|jurisdiction))": ("it's", "its"),
        r"\b(your)\b(?=\s+going)": ("your", "you're"),
        r"\b(there)\b(?=\s+(going|being))": ("there", "they're"),
        r"\s{2,}": ("  ", " "),  # Multiple spaces to single space
        r"[.]{2,}": ("...", "..."),  # Multiple periods to ellipsis
    }
    
    for pattern_str, (error_text, suggestion) in grammar_issues.items():
        pattern = re.compile(pattern_str, re.IGNORECASE)
        matches = pattern.findall(highlighted)
        if matches:
            for match in matches:
                if isinstance(match, tuple):
                    match = match[0]  # Take first group if it's a tuple
                issues_found.append(f"Grammar: {match} → {suggestion}")
            highlighted = pattern.sub(
                rf"<span style='background-color: #d4edda; color: #155724;' title='Grammar issue: Use \"{suggestion}\" instead' data-issue-index='{issue_index}'>\g<0></span>",
                highlighted,
            )
            issue_index += 1
    
    # Special case for word repetition
    repetition_pattern = r"(\w+)\s+(\w+)\s+\1\s+\2"
    repetition_matches = re.findall(repetition_pattern, highlighted, re.IGNORECASE)
    if repetition_matches:
        for match in repetition_matches:
            repeated_phrase = f"{match[0]} {match[1]}"
            issues_found.append(f"Grammar: {repeated_phrase} {repeated_phrase} → {repeated_phrase}")
        highlighted = re.sub(
            repetition_pattern,
            rf"<span style='background-color: #d4edda; color: #155724;' title='Grammar issue: Remove repeated words' data-issue-index='{issue_index}'>\1 \2 \1 \2</span>",
            highlighted,
            flags=re.IGNORECASE
        )
        issue_index += 1
    
    # 4. LEGAL TERMINOLOGY IMPROVEMENTS
    legal_improvements = {
        r"\baccording to\b": ("according to", "pursuant to"),
        r"\babout\b": ("about", "regarding"),
        r"\bbecause\b": ("because", "due to"),
        r"\bget\b": ("get", "obtain"),
        r"\bshow\b": ("show", "demonstrate"),
        r"\bbig\b": ("big", "substantial"),
        r"\bthing\b": ("thing", "matter"),
    }
    
    for pattern_str, (error_word, suggestion) in legal_improvements.items():
        pattern = re.compile(pattern_str, re.IGNORECASE)
        matches = pattern.findall(highlighted)
        if matches:
            for match in matches:
                issues_found.append(f"Legal terminology: {match} → {suggestion}")
            highlighted = pattern.sub(
                rf"<span style='background-color: #e2e3f0; color: #383d41;' title='Legal terminology: Consider \"{suggestion}\" for formal tone' data-issue-index='{issue_index}'>\g<0></span>",
                highlighted,
            )
            issue_index += 1
    
    # 5. SENTENCE STRUCTURE ANALYSIS
    sentences = re.split(r'[.!?]+', text)
    for sentence in sentences:
        sentence = sentence.strip()
        if sentence:
            # Check for overly long sentences (>40 words)
            word_count = len(sentence.split())
            if word_count > 40:
                issues_found.append(f"Sentence structure: Consider breaking down long sentence ({word_count} words)")
            
            # Check for passive voice (basic detection)
            passive_patterns = [r'\bis\s+\w+ed\b', r'\bwas\s+\w+ed\b', r'\bwere\s+\w+ed\b', r'\bbeen\s+\w+ed\b']
            for passive_pattern in passive_patterns:
                if re.search(passive_pattern, sentence, re.IGNORECASE):
                    issues_found.append("Writing style: Consider using active voice for clarity")
                    break

    print(f"Fallback analysis - Final highlighted text: {highlighted[:200]}...")  # Debug print
    print(f"Fallback analysis - Issues found: {issues_found}")  # Debug print
    
    return {
        "highlighted_text": highlighted,
        "issues_found": issues_found,
        "total_issues": len(issues_found)
    }

@app.post("/log-change")
async def log_change(payload: LogChangeRequest):
    """Log applied changes to a text file"""
    try:
        # Create log entry
        log_entry = f"""
==========================================
TIMESTAMP: {payload.timestamp}
DOCUMENT: {payload.document_name}
CATEGORY: {payload.category}
ORIGINAL: "{payload.original_text}"
SUGGESTED: "{payload.suggested_text}"
==========================================
"""
        
        # Append to log file
        log_file_path = "changes_log.txt"
        with open(log_file_path, "a", encoding="utf-8") as log_file:
            log_file.write(log_entry)
        
        print(f"Logged change: {payload.category} - {payload.original_text} → {payload.suggested_text}")
        
        return {
            "status": "success",
            "message": "Change logged successfully"
        }
    except Exception as e:
        print(f"Error logging change: {e}")
        return {
            "status": "error",
            "message": f"Failed to log change: {str(e)}"
        }

@app.get("/get-log")
async def get_log():
    """Retrieve the contents of the changes log file"""
    try:
        log_file_path = "changes_log.txt"
        if not os.path.exists(log_file_path):
            return {
                "status": "success",
                "log_content": "No changes have been logged yet.",
                "total_entries": 0
            }
        
        with open(log_file_path, "r", encoding="utf-8") as log_file:
            content = log_file.read()
        
        # Count entries by counting the separator lines
        entry_count = content.count("==========================================") // 2
        
        return {
            "status": "success",
            "log_content": content,
            "total_entries": entry_count
        }
    except Exception as e:
        print(f"Error reading log file: {e}")
        return {
            "status": "error",
            "message": f"Failed to read log file: {str(e)}",
            "log_content": "",
            "total_entries": 0
        }

@app.post("/legal-advice")
async def get_legal_advice(payload: LegalAdviceRequest):
    """Get AI-powered legal advice and analysis using Mistral AI"""
    
    if not mistral_client:
        return {
            "advice": "Legal advice feature is currently unavailable. Please set up your Mistral API key.",
            "error": "Mistral AI client not initialized"
        }
    
    try:
        # Prepare the prompt for legal analysis
        system_prompt = """You are an expert legal assistant specializing in document analysis and legal writing. 
        Provide professional, accurate legal analysis while being clear that this is AI-generated guidance and not substitute for professional legal counsel.
        
        Focus on:
        1. Legal structure and formatting
        2. Potential legal issues or gaps
        3. Clarity and precision of legal language
        4. Compliance considerations
        5. Practical recommendations
        
        Always include a disclaimer about seeking professional legal advice for specific situations."""
        
        user_prompt = f"""Please analyze this legal document and provide detailed advice:

DOCUMENT TEXT:
{payload.text}

SPECIFIC QUESTION: {payload.question}

Please provide:
1. Overall document assessment
2. Specific legal issues identified
3. Suggestions for improvement
4. Risk assessment
5. Next steps recommendations"""

        # Make request to Mistral
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        chat_response = mistral_client.chat.complete(
            model="mistral-large-latest",
            messages=messages,
            temperature=0.3,  # Lower temperature for more focused legal advice
            max_tokens=1500
        )
        
        advice = chat_response.choices[0].message.content
        
        return {
            "advice": advice,
            "model_used": "mistral-large-latest",
            "success": True
        }
        
    except Exception as e:
        print(f"Error getting legal advice: {e}")
        return {
            "advice": f"Sorry, I encountered an error while generating legal advice: {str(e)}",
            "error": str(e),
            "success": False
        }

@app.post("/upload-pdf")
async def upload_document(file: UploadFile = File(...)):
    # Check if the file is a PDF or DOCX
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File must be a PDF or DOCX document")
    
    try:
        # Determine file type and create appropriate temporary file
        is_pdf = file.content_type == "application/pdf"
        suffix = ".pdf" if is_pdf else ".docx"
        
        # Create a temporary file to save the uploaded document
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Extract text based on file type
        if is_pdf:
            extracted_text = extract_text_from_pdf(temp_file_path)
        else:
            if DOCX_SUPPORT:
                extracted_text = extract_text_from_docx(temp_file_path)
            else:
                extracted_text = "DOCX processing is temporarily unavailable. Please upload a PDF file instead."
        
        # Clean up the temporary file
        os.unlink(temp_file_path)
        
        if not extracted_text.strip():
            file_type = "PDF" if is_pdf else "DOCX"
            raise HTTPException(status_code=400, detail=f"Could not extract text from {file_type}")
        
        return {
            "text": extracted_text,
            "filename": file.filename,
            "file_type": "PDF" if is_pdf else "DOCX",
            "message": f"{'PDF' if is_pdf else 'DOCX'} uploaded and processed successfully"
        }
    
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

# For Zappa deployment - the app instance is used directly
