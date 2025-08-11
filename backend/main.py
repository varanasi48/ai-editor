from fastapi import FastAPI, Request, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    custom_prompt: str = ""
    username: str = "anonymous"
    document_name: str = ""

class LegalAdviceRequest(BaseModel):
    text: str
    question: str = "Please provide legal analysis and suggestions for this document."

class LogChangeRequest(BaseModel):
    category: str
    original_text: str
    suggested_text: str
    document_name: str
    username: str
    reason: str = ""
    timestamp: str

class ChatRequest(BaseModel):
    text: str
    question: str
    username: str = "anonymous"
    document_name: str = ""

@app.post("/analyze")
async def analyze_text(payload: AnalyzeRequest):
    text = payload.text
    custom_prompt = payload.custom_prompt or ""
    username = payload.username
    document_name = payload.document_name
    
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
        # Fallback to rule-based analysis if Mistral is not available
        return fallback_rule_based_analysis(text)
    
    try:
        # Use Mistral AI for intelligent document analysis
        base_system_prompt = """You are a comprehensive document intelligence agent - a senior editor who combines technical precision with strategic insight and contextual awareness.

**YOUR MULTI-LAYERED ROLE:**

1. **TECHNICAL CORRECTIONS**: Find and fix spelling, grammar, punctuation, and formatting issues
2. **CONTEXTUAL ANALYSIS**: Understand document type, purpose, audience, and strategic goals  
3. **REAL-TIME SUGGESTIONS**: Provide immediate improvements based on document context
4. **PROJECTED RECOMMENDATIONS**: Suggest forward-thinking enhancements to make the document more appealing, persuasive, and effective

**ANALYSIS APPROACH:**
- **Document Intelligence**: First understand what this document is trying to achieve and who will read it
- **Correction Layer**: Fix technical issues with exact replacements
- **Enhancement Layer**: Improve language, tone, and structure based on context
- **Strategic Layer**: Suggest improvements that make the document more compelling and effective
- **Future-Proofing**: Recommend changes that anticipate reader needs and market trends

**JSON RESPONSE FORMAT:**
{
  "document_intelligence": {
    "type": "Contract/Agreement/Policy/Report/etc.",
    "purpose": "What this document is trying to accomplish", 
    "audience": "Who will read this and what they care about",
    "context_assessment": "Current strengths and improvement opportunities"
  },
  "issues": [
    {
      "category": "Spelling|Grammar|Style|Legal terminology|Clarity|Punctuation|Formatting",
      "original_text": "exact text to fix/improve",
      "suggested_text": "exact replacement/enhancement",
      "explanation": "What needs changing and why",
      "appeal_impact": "How this makes the document more appealing/effective",
      "context_fit": "Why this fits the document's purpose and audience"
    }
  ],
  "real_time_suggestions": [
    {
      "area": "Structure|Language|Legal Terms|Business Impact|etc.",
      "current_state": "What the document currently does",
      "suggested_improvement": "Specific actionable change", 
      "immediate_benefit": "How this helps right now"
    }
  ],
  "projected_recommendations": [
    {
      "strategic_area": "Market Appeal|Legal Strength|Reader Engagement|Future-Proofing|etc.",
      "recommendation": "Forward-thinking suggestion",
      "projected_impact": "How this makes the document more appealing/effective long-term",
      "implementation_tip": "How to apply this suggestion"
    }
  ],
  "appeal_score": {
    "current_rating": "X/10 based on clarity, professionalism, and effectiveness",
    "key_improvements": ["List 3-5 changes that would significantly boost appeal"],
    "competitive_advantages": ["What would make this document stand out"]
  }
}

**FOCUS ON MAKING DOCUMENTS MORE APPEALING:**
- Make language more persuasive and compelling
- Enhance credibility and authority  
- Improve reader engagement and comprehension
- Add elements that build trust and confidence
- Suggest modern, forward-thinking approaches
- Consider market trends and best practices

**CRITICAL**: Provide both immediate technical fixes AND strategic improvements that make the document more appealing, persuasive, and effective for its intended purpose."""

        # Add custom prompt if provided
        if custom_prompt:
            system_prompt = f"{base_system_prompt}\n\nADDITIONAL USER INSTRUCTIONS: {custom_prompt}\n\nPlease prioritize and focus on the areas mentioned in the user instructions while maintaining the same JSON response format."
        else:
            system_prompt = base_system_prompt

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
        try:
            ai_data = json.loads(ai_response)
            issues = ai_data.get("issues", [])
            document_intelligence = ai_data.get("document_intelligence", {})
            real_time_suggestions = ai_data.get("real_time_suggestions", [])
            projected_recommendations = ai_data.get("projected_recommendations", [])
            appeal_score = ai_data.get("appeal_score", {})
        except json.JSONDecodeError:
            print("Failed to parse AI response as JSON, falling back to rule-based analysis")
            return fallback_rule_based_analysis(text)
        
        # Process the AI suggestions and create highlighted text
        highlighted = text
        issues_found = []
        contextual_insights = []
        strategic_recommendations = []
        
        # Process document intelligence
        doc_type = document_intelligence.get("type", "Document")
        doc_purpose = document_intelligence.get("purpose", "")
        doc_audience = document_intelligence.get("audience", "")
        context_assessment = document_intelligence.get("context_assessment", "")
        
        # Process real-time suggestions
        for suggestion in real_time_suggestions:
            area = suggestion.get("area", "General")
            improvement = suggestion.get("suggested_improvement", "")
            benefit = suggestion.get("immediate_benefit", "")
            if improvement:
                contextual_insights.append(f"🔄 {area}: {improvement} → {benefit}")
        
        # Process projected recommendations  
        for rec in projected_recommendations:
            strategic_area = rec.get("strategic_area", "General")
            recommendation = rec.get("recommendation", "")
            impact = rec.get("projected_impact", "")
            tip = rec.get("implementation_tip", "")
            if recommendation:
                rec_text = f"🎯 {strategic_area}: {recommendation}"
                if impact:
                    rec_text += f" | Impact: {impact}"
                if tip:
                    rec_text += f" | Tip: {tip}"
                strategic_recommendations.append(rec_text)
        
        # Process appeal score
        current_rating = appeal_score.get("current_rating", "Not rated")
        key_improvements = appeal_score.get("key_improvements", [])
        competitive_advantages = appeal_score.get("competitive_advantages", [])
        
        # Don't sort issues - keep original order to maintain index consistency
        for issue_index, issue in enumerate(issues):
            original = issue.get("original_text", "")
            suggested = issue.get("suggested_text", "")
            category = issue.get("category", "Issue")
            explanation = issue.get("explanation", "")
            appeal_impact = issue.get("appeal_impact", "")
            context_fit = issue.get("context_fit", "")
            
            if original and suggested:
                # Create comprehensive issue entry
                issue_text = f"{category}: {original} → {suggested}"
                if explanation:
                    issue_text += f" | {explanation}"
                if appeal_impact:
                    issue_text += f" | Appeal: {appeal_impact}"
                if context_fit:
                    issue_text += f" | Context: {context_fit}"
                
                issues_found.append(issue_text)
                
                # Create highlight based on category with original category colors
                if "spelling" in category.lower():
                    highlight_style = "background-color: #ffe0e0; color: #a00; border-left: 3px solid #d00;"
                elif "grammar" in category.lower():
                    highlight_style = "background-color: #d4edda; color: #155724; border-left: 3px solid #28a745;"
                elif "style" in category.lower():
                    highlight_style = "background-color: #fff3cd; color: #856404; border-left: 3px solid #ffc107;"
                elif "legal" in category.lower():
                    highlight_style = "background-color: #e2e3f0; color: #383d41; border-left: 3px solid #007bff;"
                elif "clarity" in category.lower():
                    highlight_style = "background-color: #d1ecf1; color: #0c5460; border-left: 3px solid #17a2b8;"
                elif "punctuation" in category.lower():
                    highlight_style = "background-color: #f8d7da; color: #721c24; border-left: 3px solid #dc3545;"
                elif "formatting" in category.lower():
                    highlight_style = "background-color: #e2e3f0; color: #383d41; border-left: 3px solid #6f42c1;"
                else:
                    highlight_style = "background-color: #f8f9fa; color: #495057; border-left: 3px solid #6c757d;"
                
                # Create comprehensive tooltip
                tooltip_parts = [f"CHANGE: {original} → {suggested}"]
                if explanation:
                    tooltip_parts.append(f"WHY: {explanation}")
                if appeal_impact:
                    tooltip_parts.append(f"APPEAL: {appeal_impact}")
                if context_fit:
                    tooltip_parts.append(f"CONTEXT: {context_fit}")
                
                tooltip_text = " | ".join(tooltip_parts)
                
                # Replace text with highlighted version
                pattern = re.compile(re.escape(original), re.IGNORECASE)
                if pattern.search(highlighted):
                    highlighted = pattern.sub(
                        f"<span style='{highlight_style} padding: 2px 4px; border-radius: 3px;' title='{tooltip_text}' data-issue-index='{issue_index}'>{original}</span>",
                        highlighted,
                        count=1
                    )
        
        print(f"Final highlighted text: {highlighted[:200]}...")  # Debug print
        print(f"Issues found: {issues_found}")  # Debug print
        print(f"Contextual insights: {contextual_insights}")  # Debug print
        print(f"Strategic recommendations: {strategic_recommendations}")  # Debug print
        
        return {
            "highlighted_text": highlighted,
            "issues_found": issues_found,
            "total_issues": len(issues_found),
            "document_intelligence": {
                "type": doc_type,
                "purpose": doc_purpose,
                "audience": doc_audience,
                "assessment": context_assessment
            },
            "contextual_insights": contextual_insights,
            "strategic_recommendations": strategic_recommendations,
            "appeal_score": {
                "rating": current_rating,
                "key_improvements": key_improvements,
                "competitive_advantages": competitive_advantages
            },
            "colleague_analysis": f"📋 {doc_type}" + (f" - {context_assessment}" if context_assessment else "")
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
    """Log applied changes to a user-specific document log file"""
    try:
        # Create logs directory if it doesn't exist
        import os
        logs_dir = "logs"
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir)
        
        # Create user-specific directory
        user_logs_dir = os.path.join(logs_dir, payload.username)
        if not os.path.exists(user_logs_dir):
            os.makedirs(user_logs_dir)
        
        # Sanitize document name for filename
        safe_doc_name = "".join(c for c in payload.document_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_doc_name = safe_doc_name.replace(' ', '_')
        if not safe_doc_name:
            safe_doc_name = "untitled_document"
        
        # Create document-specific log file
        log_file_path = os.path.join(user_logs_dir, f"{safe_doc_name}_changes.txt")
        
        # Create log entry
        log_entry = f"""
==========================================
TIMESTAMP: {payload.timestamp}
USER: {payload.username}
DOCUMENT: {payload.document_name}
CATEGORY: {payload.category}
ORIGINAL: "{payload.original_text}"
SUGGESTED: "{payload.suggested_text}"
REASON: {payload.reason if payload.reason else "No reason provided"}
==========================================
"""
        
        # Append to log file
        with open(log_file_path, "a", encoding="utf-8") as log_file:
            log_file.write(log_entry)
        
        print(f"Logged change for user {payload.username}: {payload.category} - {payload.original_text} → {payload.suggested_text}")
        
        return {
            "status": "success",
            "message": "Change logged successfully",
            "log_file": log_file_path
        }
    except Exception as e:
        print(f"Error logging change: {e}")
        return {
            "status": "error",
            "message": f"Failed to log change: {str(e)}"
        }

@app.get("/get-log")
async def get_log():
    """Retrieve the contents of the changes log file (legacy endpoint)"""
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

@app.get("/get-user-document-log/{username}/{document_name}")
async def get_user_document_log(username: str, document_name: str):
    """Retrieve the log for a specific user and document"""
    try:
        # Sanitize document name for filename
        safe_doc_name = "".join(c for c in document_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_doc_name = safe_doc_name.replace(' ', '_')
        if not safe_doc_name:
            safe_doc_name = "untitled_document"
        
        log_file_path = os.path.join("logs", username, f"{safe_doc_name}_changes.txt")
        
        if not os.path.exists(log_file_path):
            return {
                "status": "success",
                "log_content": f"No changes have been logged yet for document '{document_name}' by user '{username}'.",
                "total_entries": 0,
                "document_name": document_name,
                "username": username
            }
        
        with open(log_file_path, "r", encoding="utf-8") as log_file:
            content = log_file.read()
        
        # Count entries by counting the separator lines
        entry_count = content.count("==========================================") // 2
        
        return {
            "status": "success",
            "log_content": content,
            "total_entries": entry_count,
            "document_name": document_name,
            "username": username
        }
    except Exception as e:
        print(f"Error reading user document log: {e}")
        return {
            "status": "error",
            "message": f"Failed to read log file: {str(e)}",
            "log_content": "",
            "total_entries": 0,
            "document_name": document_name,
            "username": username
        }

@app.get("/get-user-logs/{username}")
async def get_user_logs(username: str):
    """Retrieve all document logs for a specific user"""
    try:
        user_logs_dir = os.path.join("logs", username)
        
        if not os.path.exists(user_logs_dir):
            return {
                "status": "success",
                "documents": [],
                "total_documents": 0,
                "username": username
            }
        
        documents = []
        for filename in os.listdir(user_logs_dir):
            if filename.endswith("_changes.txt"):
                doc_name = filename.replace("_changes.txt", "").replace("_", " ")
                file_path = os.path.join(user_logs_dir, filename)
                
                # Get file stats
                stat = os.stat(file_path)
                
                # Count entries
                entry_count = 0
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        entry_count = content.count("==========================================") // 2
                except:
                    entry_count = 0
                
                documents.append({
                    "document_name": doc_name,
                    "filename": filename,
                    "total_entries": entry_count,
                    "last_modified": stat.st_mtime
                })
        
        # Sort by last modified (newest first)
        documents.sort(key=lambda x: x["last_modified"], reverse=True)
        
        return {
            "status": "success",
            "documents": documents,
            "total_documents": len(documents),
            "username": username
        }
    except Exception as e:
        print(f"Error reading user logs: {e}")
        return {
            "status": "error",
            "message": f"Failed to read user logs: {str(e)}",
            "documents": [],
            "total_documents": 0,
            "username": username
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

@app.post("/chat")
async def chat_with_document(payload: ChatRequest):
    """Chat endpoint for answering questions about the document"""
    text = payload.text
    question = payload.question
    username = payload.username
    document_name = payload.document_name
    
    print(f"Chat question: {question}")  # Debug print
    print(f"Document text: {text[:100]}...")  # Debug print (first 100 chars)

    # Log the chat request if document info is provided
    if username != "anonymous" and document_name:
        try:
            user_projects_dir = os.path.join("projects", username)
            document_folder = os.path.join(user_projects_dir, document_name)
            if os.path.exists(document_folder):
                log_file_path = os.path.join(document_folder, f"{document_name}_activity.log")
                log_entry = f"[{datetime.now().isoformat()}] CHAT - Question asked: '{question}' (User: {username})\n"
                with open(log_file_path, "a", encoding="utf-8") as log_file:
                    log_file.write(log_entry)
        except Exception as e:
            print(f"Error logging chat: {e}")

    if not mistral_client:
        return {
            "response": "AI chat is currently unavailable. Please try again later.",
            "error": "Mistral AI client not initialized",
            "success": False
        }
    
    try:
        # Create a conversational system prompt
        system_prompt = """You are an expert legal colleague and document specialist working alongside the user. Think of yourself as their most knowledgeable coworker who deeply understands legal documents, business contexts, and strategic implications.

Your approach:
- **Understand the CONTEXT**: First, identify what type of document this is, its business purpose, and stakeholders involved
- **Think like a colleague**: Provide insights that go beyond surface-level answers - explain WHY things matter
- **Be comprehensive**: Address both immediate questions AND strategic considerations
- **Technical expertise**: Provide technical legal insights, industry best practices, and potential risks/opportunities
- **Practical perspective**: Consider real-world implications and implementation challenges

When responding:
1. **Context Understanding**: Start by showing you understand the document's purpose and context
2. **Direct Answer**: Answer the specific question asked
3. **Strategic Insights**: Provide additional insights about implications, risks, or opportunities
4. **Technical Recommendations**: Suggest improvements, alternatives, or considerations
5. **Next Steps**: When relevant, suggest what the user should consider or do next

Be conversational but professional, like a knowledgeable colleague discussing the document over coffee. Reference specific parts of the document and explain their significance in the broader context."""

        user_prompt = f"""Based on this legal document:

{text}

Please answer this question: {question}

Provide a helpful, specific answer based on the document content."""
        
        # Call Mistral AI for conversational response
        response = mistral_client.chat.complete(
            model="mistral-large-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        ai_response = response.choices[0].message.content
        print(f"AI Chat Response: {ai_response[:200]}...")  # Debug print
        
        return {
            "response": ai_response,
            "success": True
        }
        
    except Exception as e:
        print(f"Error with chat response: {e}")
        return {
            "response": f"Sorry, I encountered an error while processing your question: {str(e)}",
            "error": str(e),
            "success": False
        }

@app.post("/upload-pdf")
async def upload_document(file: UploadFile = File(...), username: str = Form("anonymous")):
    # Check if the file is a PDF or DOCX
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    try:
        # Create projects folder structure: projects/username/documentname
        projects_dir = "projects"
        if not os.path.exists(projects_dir):
            os.makedirs(projects_dir)
        
        # Create user-specific directory
        user_projects_dir = os.path.join(projects_dir, username)
        if not os.path.exists(user_projects_dir):
            os.makedirs(user_projects_dir)
        
        # Generate document folder name (remove file extension and sanitize)
        document_name = os.path.splitext(file.filename)[0]
        # Sanitize document name for folder creation
        document_name = re.sub(r'[<>:"/\\|?*]', '_', document_name)
        document_folder = os.path.join(user_projects_dir, document_name)
        
        # Create document-specific folder
        if not os.path.exists(document_folder):
            os.makedirs(document_folder)
        
        # Save original file in document folder
        original_file_path = os.path.join(document_folder, file.filename)
        with open(original_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Create temporary file for processing
        file_extension = ".pdf" if file.content_type == "application/pdf" else ".docx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Determine file type and extract text
        is_pdf = file.content_type == "application/pdf"
        
        if is_pdf:
            extracted_text = extract_text_from_pdf(temp_file_path)
        else:
            if DOCX_SUPPORT:
                extracted_text = extract_text_from_docx(temp_file_path)
            else:
                extracted_text = "DOCX processing is temporarily unavailable. Please upload a PDF file instead."
        
        # Save extracted text in document folder
        text_file_path = os.path.join(document_folder, f"{document_name}_extracted.txt")
        with open(text_file_path, "w", encoding="utf-8") as text_file:
            text_file.write(extracted_text)
        
        # Create activity log for this document
        log_file_path = os.path.join(document_folder, f"{document_name}_activity.log")
        log_entry = f"[{datetime.now().isoformat()}] UPLOAD - Document uploaded: {file.filename} (User: {username})\n"
        with open(log_file_path, "a", encoding="utf-8") as log_file:
            log_file.write(log_entry)
        
        # Clean up the temporary file
        os.unlink(temp_file_path)
        
        if not extracted_text.strip():
            file_type = "PDF" if is_pdf else "DOCX"
            raise HTTPException(status_code=400, detail=f"Could not extract text from {file_type}")
        
        return {
            "text": extracted_text,
            "filename": file.filename,
            "document_name": document_name,
            "file_type": "PDF" if is_pdf else "DOCX",
            "project_path": document_folder,
            "message": f"{'PDF' if is_pdf else 'DOCX'} uploaded and processed successfully. Saved to projects/{username}/{document_name}/"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/projects/{username}")
async def list_user_projects(username: str):
    """List all projects for a specific user"""
    try:
        projects_dir = "projects"
        user_projects_dir = os.path.join(projects_dir, username)
        
        if not os.path.exists(user_projects_dir):
            return {"projects": [], "message": f"No projects found for user: {username}"}
        
        projects = []
        for document_folder in os.listdir(user_projects_dir):
            document_path = os.path.join(user_projects_dir, document_folder)
            if os.path.isdir(document_path):
                # Get files in the document folder
                files = []
                try:
                    for file in os.listdir(document_path):
                        file_path = os.path.join(document_path, file)
                        if os.path.isfile(file_path):
                            # Get file stats
                            stats = os.stat(file_path)
                            files.append({
                                "name": file,
                                "size": stats.st_size,
                                "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                                "type": "log" if file.endswith("_activity.log") else ("original" if not file.endswith("_extracted.txt") else "extracted")
                            })
                except Exception as e:
                    print(f"Error reading files in {document_path}: {e}")
                
                projects.append({
                    "document_name": document_folder,
                    "path": document_path,
                    "files": files,
                    "created": datetime.fromtimestamp(os.path.getctime(document_path)).isoformat()
                })
        
        # Sort projects by creation date (newest first)
        projects.sort(key=lambda x: x["created"], reverse=True)
        
        return {
            "username": username,
            "projects": projects,
            "total_projects": len(projects)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing projects: {str(e)}")

@app.get("/projects")
async def list_all_projects():
    """List all projects for all users"""
    try:
        projects_dir = "projects"
        
        if not os.path.exists(projects_dir):
            return {"users": [], "message": "No projects directory found"}
        
        all_users = []
        for username in os.listdir(projects_dir):
            user_path = os.path.join(projects_dir, username)
            if os.path.isdir(user_path):
                # Count documents for this user
                document_count = len([d for d in os.listdir(user_path) if os.path.isdir(os.path.join(user_path, d))])
                all_users.append({
                    "username": username,
                    "document_count": document_count,
                    "last_activity": datetime.fromtimestamp(os.path.getmtime(user_path)).isoformat()
                })
        
        # Sort users by last activity (newest first)
        all_users.sort(key=lambda x: x["last_activity"], reverse=True)
        
        return {
            "users": all_users,
            "total_users": len(all_users)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing all projects: {str(e)}")

@app.get("/projects/{username}/{document_name}/log")
async def get_document_log(username: str, document_name: str):
    """Get the activity log for a specific document"""
    try:
        projects_dir = "projects"
        document_folder = os.path.join(projects_dir, username, document_name)
        log_file_path = os.path.join(document_folder, f"{document_name}_activity.log")
        
        if not os.path.exists(log_file_path):
            return {"log_entries": [], "message": "No activity log found for this document"}
        
        with open(log_file_path, "r", encoding="utf-8") as log_file:
            log_content = log_file.read()
            
        # Parse log entries
        log_entries = []
        for line in log_content.strip().split('\n'):
            if line.strip():
                # Parse log format: [timestamp] ACTION - description (User: username)
                try:
                    timestamp_end = line.find('] ')
                    if timestamp_end != -1:
                        timestamp = line[1:timestamp_end]
                        rest = line[timestamp_end + 2:]
                        
                        action_end = rest.find(' - ')
                        if action_end != -1:
                            action = rest[:action_end]
                            description = rest[action_end + 3:]
                            
                            log_entries.append({
                                "timestamp": timestamp,
                                "action": action,
                                "description": description,
                                "raw_line": line
                            })
                except Exception as parse_error:
                    print(f"Error parsing log line: {line}, Error: {parse_error}")
                    log_entries.append({
                        "timestamp": "",
                        "action": "UNKNOWN",
                        "description": line,
                        "raw_line": line
                    })
        
        return {
            "username": username,
            "document_name": document_name,
            "log_entries": log_entries,
            "total_entries": len(log_entries)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching document log: {str(e)}")

@app.get("/projects/{username}/{document_name}/{file_name}")
async def get_project_file(username: str, document_name: str, file_name: str):
    """Serve a specific file from a user's project"""
    try:
        projects_dir = "projects"
        file_path = os.path.join(projects_dir, username, document_name, file_name)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Security check - ensure the file is within the projects directory
        abs_file_path = os.path.abspath(file_path)
        abs_projects_dir = os.path.abspath(projects_dir)
        
        if not abs_file_path.startswith(abs_projects_dir):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Read and return the file content
        if file_name.endswith('_extracted.txt') or file_name.endswith('_activity.log'):
            # Serve text files directly
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if file_name.endswith('_activity.log'):
                # For log files, return as downloadable content
                from fastapi.responses import Response
                return Response(
                    content=content,
                    media_type='text/plain',
                    headers={"Content-Disposition": f"attachment; filename={file_name}"}
                )
            else:
                return {"content": content, "filename": file_name, "type": "text"}
        else:
            # For binary files, return file info
            stats = os.stat(file_path)
            return {
                "filename": file_name,
                "size": stats.st_size,
                "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                "type": "binary",
                "message": "Binary file - use direct download"
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing file: {str(e)}")

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

@app.post("/save-transcript")
async def save_transcript(request: Request):
    """Save medical consultation transcript"""
    try:
        payload = await request.json()
        username = payload.get('username')
        transcript = payload.get('transcript', '')
        session_info = payload.get('sessionInfo', {})
        segments = payload.get('segments', [])
        
        if not username:
            raise HTTPException(status_code=400, detail="Username is required")
        
        # Create transcript directory structure
        transcripts_dir = "transcripts"
        if not os.path.exists(transcripts_dir):
            os.makedirs(transcripts_dir)
        
        # Create user-specific directory
        user_transcripts_dir = os.path.join(transcripts_dir, username)
        if not os.path.exists(user_transcripts_dir):
            os.makedirs(user_transcripts_dir)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        transcript_filename = f"medical_transcript_{timestamp}.txt"
        metadata_filename = f"medical_transcript_{timestamp}_metadata.json"
        
        transcript_path = os.path.join(user_transcripts_dir, transcript_filename)
        metadata_path = os.path.join(user_transcripts_dir, metadata_filename)
        
        # Save transcript text
        with open(transcript_path, 'w', encoding='utf-8') as f:
            f.write(transcript)
        
        # Save metadata (session info and segments)
        metadata = {
            'username': username,
            'timestamp': timestamp,
            'session_info': session_info,
            'segments': segments,
            'transcript_file': transcript_filename
        }
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return {
            "success": True,
            "message": "Transcript saved successfully",
            "transcript_file": transcript_filename,
            "metadata_file": metadata_filename
        }
        
    except Exception as e:
        print(f"Error saving transcript: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save transcript: {str(e)}")

# For Zappa deployment - the app instance is used directly
