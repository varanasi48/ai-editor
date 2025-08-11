import React, { useState, useRef, useEffect } from "react";
import './App.css';
import Login from './components/Login';
import Header from './components/Header';
import LogViewer from './components/LogViewer';
import PromptBar from './components/PromptBar';
import ProjectsManager from './components/ProjectsManager';

function App() {
  // Use environment variable for API URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
  
  // Version for cache busting
  const APP_VERSION = "v3.0.0-" + Date.now();
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check for existing login on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('incsyncedits_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData.username);
      } catch (error) {
        localStorage.removeItem('incsyncedits_user');
      }
    }
    setIsLoading(false);
  }, []);
  
  // Force title update
  useEffect(() => {
    document.title = "insync-edits";
    // Update meta tags
    const metaTitle = document.querySelector('meta[name="title"]');
    if (metaTitle) metaTitle.setAttribute('content', 'incsync-edits');
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', 'incsync-edits');
    
    const twitterTitle = document.querySelector('meta[property="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', 'incsync-edits');
  }, []);
  
  const [pdfText, setPdfText] = useState("Upload a PDF or DOCX file to see its content here.");
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [editableText, setEditableText] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
  const [customPrompt, setCustomPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [showProjects, setShowProjects] = useState(false);
  const editableParagraphRef = useRef(null);

  // Authentication handlers
  const handleLogin = (username) => {
    setUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('insyncedits_user');
    setUser(null);
    // Reset app state
    setPdfText("Upload a PDF or DOCX file to see its content here.");
    setAnalysisResults(null);
    setEditableText("");
    setHasAnalyzed(false);
    setAppliedSuggestions(new Set());
    setFileName("");
    setChatHistory([]);
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🤖</div>
          <div style={{ fontSize: '18px', color: '#6c757d' }}>Loading insync-edits...</div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PDF or DOCX file.");
      return;
    }

    setUploading(true);
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("username", user || "anonymous");

    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdf`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload error:", errorText);
        throw new Error(`Failed to upload file: ${response.status}`);
      }

      const data = await response.json();
      console.log("Upload successful:", data);
      setPdfText(data.text);
      setEditableText(data.text);
      setHasAnalyzed(false);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDocument = async (project, extractedFile) => {
    try {
      // Load the extracted text file using the new API endpoint
      const response = await fetch(`${API_BASE_URL}/projects/${user}/${project.document_name}/${extractedFile.name}`);
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          setPdfText(data.content);
          setEditableText(data.content);
          setFileName(project.document_name);
          setHasAnalyzed(false);
          setAnalysisResults(null);
          setChatHistory([]);
          console.log(`Document loaded: ${project.document_name}`);
        } else {
          throw new Error("No content received");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Error loading document:", error);
      alert(`Could not load the selected document: ${error.message}`);
    }
  };

  const handleAnalyze = async (promptText = customPrompt) => {
    if (!editableText || editableText === "Upload a PDF or DOCX file to see its content here.") {
      alert("Please enter or upload some text to analyze.");
      return;
    }

    // Add user message to chat history
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: promptText || "Analyze this document",
      timestamp: new Date().toLocaleTimeString()
    };
    setChatHistory(prev => [...prev, userMessage]);

    setLoading(true);
    
    // Determine if this is a question/chat or document analysis request
    const isQuestion = isQuestionPrompt(promptText);
    const endpoint = isQuestion ? '/chat' : '/analyze';
    
    try {
      // Extract document name from filename (remove extension)
      const documentName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "";
      
      let requestBody;
      if (isQuestion) {
        // For chat/questions, use the chat endpoint
        requestBody = {
          text: editableText,
          question: promptText || "What are the key points in this document?",
          username: user || "anonymous",
          document_name: documentName
        };
      } else {
        // For document analysis, use the analyze endpoint
        requestBody = {
          text: editableText,
          custom_prompt: promptText || "",
          username: user || "anonymous",
          document_name: documentName
        };
      }
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`${isQuestion ? 'Chat' : 'Analysis'} failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`${isQuestion ? 'Chat' : 'Analysis'} response:`, data);
      
      if (isQuestion) {
        // Handle chat response
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.response || "I'm sorry, I couldn't process your question.",
          timestamp: new Date().toLocaleTimeString()
        };
        setChatHistory(prev => [...prev, aiMessage]);
      } else {
        // Handle comprehensive analysis response with context and projections
        setAnalysisResults(data);
        setEditableText(data.highlighted_text);
        setHasAnalyzed(true);
        setAppliedSuggestions(new Set());
        
        // Create comprehensive AI response message  
        let analysisContent = `${data.colleague_analysis || 'Document Analysis Complete'}\n\n`;
        
        // Document Intelligence Summary
        if (data.document_intelligence) {
          const intel = data.document_intelligence;
          if (intel.purpose) {
            analysisContent += `📄 **Purpose**: ${intel.purpose}\n`;
          }
          if (intel.audience) {
            analysisContent += `👥 **Audience**: ${intel.audience}\n`;
          }
          analysisContent += `\n`;
        }
        
        // Appeal Score
        if (data.appeal_score && data.appeal_score.rating) {
          analysisContent += `⭐ **Appeal Score**: ${data.appeal_score.rating}\n\n`;
        }
        
        if (data.total_issues > 0) {
          analysisContent += `🔧 Found ${data.total_issues} improvements:\n\n`;
          
          data.issues_found.slice(0, 6).forEach((issue, index) => {
            const parts = issue.split(' | ');
            const mainFix = parts[0];
            const explanation = parts[1] || '';
            
            const changePart = mainFix.split(': ')[1] || mainFix;
            analysisContent += `${index + 1}. **${changePart}**\n`;
            
            if (explanation && explanation.length < 80) {
              analysisContent += `   💡 ${explanation}\n`;
            }
            analysisContent += `\n`;
          });
          
          if (data.total_issues > 6) {
            analysisContent += `... and ${data.total_issues - 6} more in document editor.\n\n`;
          }
        }
        
        // Contextual insights
        if (data.contextual_insights && data.contextual_insights.length > 0) {
          analysisContent += `🔄 **Real-time Suggestions:**\n`;
          data.contextual_insights.slice(0, 3).forEach(insight => {
            analysisContent += `${insight}\n`;
          });
          analysisContent += `\n`;
        }
        
        // Strategic recommendations
        if (data.strategic_recommendations && data.strategic_recommendations.length > 0) {
          analysisContent += `🎯 **Strategic Recommendations:**\n`;
          data.strategic_recommendations.slice(0, 3).forEach(rec => {
            const main = rec.split(' | ')[0];
            analysisContent += `${main}\n`;
          });
        }
        
        if (data.total_issues > 0) {
          analysisContent += `� Found ${data.total_issues} specific fixes:\n\n`;
          
          // Show first 8 issues with clear action items
          data.issues_found.slice(0, 8).forEach((issue, index) => {
            const parts = issue.split(' | ');
            const mainFix = parts[0]; // "Category: original → suggested"
            const explanation = parts[1] || '';
            const tip = parts[2] || '';
            
            // Extract the actual change
            const changePart = mainFix.split(': ')[1] || mainFix;
            analysisContent += `${index + 1}. ${changePart}\n`;
            
            if (explanation && !explanation.includes('Tip:')) {
              analysisContent += `   💡 ${explanation}\n`;
            }
            if (tip) {
              analysisContent += `   👥 ${tip}\n`;
            }
            analysisContent += `\n`;
          });
          
          if (data.total_issues > 8) {
            analysisContent += `... and ${data.total_issues - 8} more improvements available in the document editor.\n\n`;
          }
        }
        
        // Add quick wins
        if (data.actionable_suggestions && data.actionable_suggestions.length > 0) {
          analysisContent += `⚡ **Quick Wins** (biggest impact):\n`;
          data.actionable_suggestions.forEach(suggestion => {
            analysisContent += `${suggestion}\n`;
          });
        }
        
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: analysisContent,
          analysisData: data,
          timestamp: new Date().toLocaleTimeString()
        };
        setChatHistory(prev => [...prev, aiMessage]);
      }
      
      // Update custom prompt if provided via parameter (from PromptBar)
      if (promptText !== undefined) {
        setCustomPrompt(promptText);
      }
      
    } catch (error) {
      console.error(`Error ${isQuestion ? 'getting chat response' : 'analyzing text'}:`, error);
      
      // Add error message to chat history
      const errorMessage = {
        id: Date.now() + 2,
        type: 'error',
        content: `Error ${isQuestion ? 'processing question' : 'analyzing document'}: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
      
      alert(`Error ${isQuestion ? 'processing question' : 'analyzing document'}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine if a prompt is a question vs analysis request
  const isQuestionPrompt = (promptText) => {
    if (!promptText) return false;
    
    const lowerPrompt = promptText.toLowerCase().trim();
    
    // Question indicators
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'should', 'would', 'is', 'are', 'does', 'do', 'will', 'explain', 'tell me', 'help me understand'];
    const questionPatterns = [
      /\?/,  // Contains question mark
      /^(what|how|why|when|where|who|which|can|could|should|would|is|are|does|do|will)/i,  // Starts with question word
      /explain|tell me|help me understand|what does.*mean|what is|what are/i  // Explanation requests
    ];
    
    // Analysis indicators (these override question detection)
    const analysisWords = ['analyze', 'review', 'check', 'find errors', 'find issues', 'correct', 'fix', 'improve', 'suggest', 'focus on', 'look for'];
    const analysisPatterns = [
      /analyze|review|check.*error|find.*error|find.*issue|correct|fix|improve|suggest|focus on|look for/i
    ];
    
    // Check if it's clearly an analysis request
    for (const pattern of analysisPatterns) {
      if (pattern.test(lowerPrompt)) {
        return false; // It's an analysis request
      }
    }
    
    for (const word of analysisWords) {
      if (lowerPrompt.includes(word)) {
        return false; // It's an analysis request
      }
    }
    
    // Check if it's a question
    for (const pattern of questionPatterns) {
      if (pattern.test(lowerPrompt)) {
        return true; // It's a question
      }
    }
    
    for (const word of questionWords) {
      if (lowerPrompt.startsWith(word)) {
        return true; // It's a question
      }
    }
    
    // Default to analysis if unclear
    return false;
  };

  const handleApplySuggestion = (issueIndex) => {
    if (!analysisResults || !analysisResults.issues_found[issueIndex]) return;
    
    const issue = analysisResults.issues_found[issueIndex];
    
    // Parse the new format: "Category: original → suggested | reason"
    const mainParts = issue.split(' | ');
    const issueContent = mainParts[0];
    const reason = mainParts[1] || '';
    
    const parts = issueContent.split(' → ');
    if (parts.length !== 2) return;
    
    const errorPart = parts[0];
    const suggestion = parts[1];
    
    // Extract the actual text to replace (after the category prefix)
    const colonIndex = errorPart.indexOf(': ');
    const originalText = colonIndex > -1 ? errorPart.substring(colonIndex + 2) : errorPart;
    
    console.log('=== APPLYING SUGGESTION ===');
    console.log('Looking for:', JSON.stringify(originalText));
    console.log('Replace with:', JSON.stringify(suggestion));
    console.log('Reason:', reason);
    
    const currentElement = editableParagraphRef.current;
    if (!currentElement) return;
    
    // Get current HTML content
    let currentHTML = currentElement.innerHTML;
    
    // Create the highlighted replacement
    const highlighted = `<span style="background-color: #20b2aa; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;">${suggestion}</span>`;
    
    // Method 1: Simple direct HTML replacement
    if (currentHTML.includes(originalText)) {
      const newHTML = currentHTML.replace(originalText, highlighted);
      console.log('Direct HTML replacement successful!');
      currentElement.innerHTML = newHTML;
      setEditableText(newHTML);
      setAppliedSuggestions(prev => new Set([...prev, issueIndex]));
      logChange(errorPart, originalText, suggestion, reason);
      return;
    }
    
    // Method 2: Try with regex
    const escapedOriginal = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOriginal, 'g');
    
    if (regex.test(currentHTML)) {
      const newHTML = currentHTML.replace(regex, highlighted);
      if (newHTML !== currentHTML) {
        console.log('Regex replacement successful!');
        currentElement.innerHTML = newHTML;
        setEditableText(newHTML);
        setAppliedSuggestions(prev => new Set([...prev, issueIndex]));
        logChange(errorPart, originalText, suggestion, reason);
        return;
      }
    }
    
    // Method 3: Check plain text content
    const currentText = currentElement.textContent || currentElement.innerText || "";
    if (currentText.includes(originalText)) {
      // Found in text but not in HTML - this means it might be inside other tags
      // Use a more flexible approach
      const words = originalText.split(' ');
      let searchHTML = currentHTML;
      
      // Try to find a pattern that matches the text even with HTML tags in between
      for (let word of words) {
        if (!searchHTML.includes(word)) {
          console.log('Word not found in HTML:', word);
          break;
        }
      }
      
      // Fallback: Replace just the first word and let user manually handle the rest
      const firstWord = words[0];
      if (currentHTML.includes(firstWord)) {
        const newHTML = currentHTML.replace(firstWord, highlighted);
        console.log('Partial replacement successful!');
        currentElement.innerHTML = newHTML;
        setEditableText(newHTML);
        setAppliedSuggestions(prev => new Set([...prev, issueIndex]));
        logChange(errorPart, originalText, suggestion, reason);
        return;
      }
    }
    
    // If all methods fail
    console.error('Text not found:', originalText);
    console.log('Current HTML preview:', currentHTML.substring(0, 500));
    console.log('Current text preview:', currentText.substring(0, 500));
    alert(`Could not find "${originalText}" in the document. Try re-analyzing the document.`);
  };

  const logChange = async (category, originalText, suggestedText, reason = '') => {
    try {
      await fetch(`${API_BASE_URL}/log-change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: category,
          original_text: originalText,
          suggested_text: suggestedText,
          document_name: fileName || "untitled",
          username: user,
          reason: reason,
          timestamp: new Date().toISOString()
        }),
      });
    } catch (error) {
      console.error("Error logging change:", error);
    }
  };

  const handleViewLog = async () => {
    setShowLogModal(true);
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f8f9fa',
      paddingBottom: '120px' // Space for PromptBar
    }}>
      {/* Top Navigation Bar */}
      <Header 
        user={user}
        onLogout={handleLogout}
        onViewLog={handleViewLog}
        onShowProjects={() => setShowProjects(true)}
        appVersion={APP_VERSION}
      />

      {/* Main Content Grid */}
      <div style={{ 
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 400px',
        gap: '20px',
        padding: '20px',
        overflow: 'hidden',
        minHeight: 0
      }}>
        
        {/* Left Panel - AI Chat Interface */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Chat Header */}
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid #e9ecef',
            backgroundColor: '#f8f9fa'
          }}>
            {/* File Upload Section */}
            <div style={{
              marginBottom: '15px',
              padding: '15px',
              border: '2px dashed #dee2e6',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: 'white'
            }}>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: uploading ? '#007bff' : '#6c757d',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: 'white'
                }}>
                  {uploading ? '⏳' : '📄'}
                </div>
                <span style={{
                  fontSize: '12px',
                  color: '#495057',
                  fontWeight: '500'
                }}>
                  {uploading ? "Uploading..." : "Upload PDF/DOCX"}
                </span>
                {fileName && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#007bff',
                    maxWidth: '150px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    📄 {fileName}
                  </span>
                )}
              </label>
            </div>

            <h2 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#333',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              💬 AI Assistant Chat
            </h2>
          </div>
          
          {/* Chat Messages */}
          <div style={{
            flex: 1,
            padding: '15px',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 400px)',
            backgroundColor: '#fefefe'
          }}>
            {chatHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#6c757d',
                fontSize: '14px',
                marginTop: '40px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🤖</div>
                <p>Upload a document and start a conversation with AI!</p>
                <p style={{ fontSize: '12px', marginTop: '10px' }}>
                  Ask questions, request analysis, or get suggestions for your document.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {chatHistory.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: message.type === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: '12px 16px',
                      borderRadius: '18px',
                      backgroundColor: message.type === 'user' 
                        ? '#007bff' 
                        : message.type === 'error' 
                          ? '#dc3545' 
                          : '#e9ecef',
                      color: message.type === 'user' || message.type === 'error' 
                        ? 'white' 
                        : '#495057',
                      fontSize: '14px',
                      lineHeight: '1.4',
                      wordBreak: 'break-word'
                    }}>
                      <div style={{ marginBottom: '4px' }}>
                        {message.content}
                      </div>
                      
                      {/* Show analysis summary for AI responses */}
                      {message.type === 'ai' && message.analysisData && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px',
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#495057'
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            📊 Analysis Summary:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '15px' }}>
                            {message.analysisData.issues_found.slice(0, 3).map((issue, idx) => {
                              const parts = issue.split(' → ');
                              const errorPart = parts[0] || '';
                              const categoryMatch = errorPart.match(/^([^:]+):\s*(.+)/);
                              const category = categoryMatch ? categoryMatch[1] : 'Issue';
                              return (
                                <li key={idx} style={{ marginBottom: '3px' }}>
                                  <strong>{category}:</strong> {categoryMatch ? categoryMatch[2] : errorPart}
                                </li>
                              );
                            })}
                            {message.analysisData.issues_found.length > 3 && (
                              <li style={{ color: '#6c757d', fontStyle: 'italic' }}>
                                ...and {message.analysisData.issues_found.length - 3} more issues
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div style={{
                      fontSize: '10px',
                      color: '#6c757d',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {message.type === 'user' ? '�' : message.type === 'error' ? '❌' : '🤖'}
                      {message.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Loading indicator */}
            {loading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#6c757d',
                fontSize: '14px',
                marginTop: '15px'
              }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px',
                  border: '2px solid #e9ecef',
                  borderTop: '2px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                AI is analyzing your document...
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Editable Document */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', paddingBottom: '15px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#333',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📝 Editable Document
            </h2>
          </div>
          
          <div 
            ref={editableParagraphRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            dangerouslySetInnerHTML={{ __html: editableText || "Upload and analyze to see editable content" }}
            onBlur={(e) => setEditableText(e.target.innerHTML)}
            style={{
              flex: 1,
              margin: '0 20px 20px',
              padding: '20px',
              backgroundColor: 'white',
              border: '2px solid #e9ecef',
              borderRadius: '6px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              lineHeight: '1.6',
              outline: 'none',
              color: '#495057',
              maxHeight: 'calc(100vh - 300px)'
            }}
          />
        </div>

        {/* Right Panel - Suggestions */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', paddingBottom: '15px' }}>
            {!hasAnalyzed ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                color: '#6c757d',
                paddingTop: '100px'
              }}>
                <div>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    margin: '0 auto 20px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '36px'
                  }}>
                    💡
                  </div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '10px',
                    color: '#495057'
                  }}>
                    Suggestions
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6c757d',
                    margin: 0
                  }}>
                    Issues and suggestions will appear here after analysis
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#333',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    💡 Suggestions
                  </h2>
                  {analysisResults && (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}>
                      {analysisResults.total_issues} issues
                    </span>
                  )}
                </div>
                
                {/* Issues List */}
                <div style={{ 
                  flex: 1, 
                  overflow: 'auto',
                  maxHeight: 'calc(100vh - 400px)',
                  paddingRight: '5px'
                }}>
                  {analysisResults && analysisResults.total_issues > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {analysisResults.issues_found.map((issue, index) => {
                        // Parse the issue format: "Category: original → suggested | reason"
                        const mainParts = issue.split(' | ');
                        const issueContent = mainParts[0];
                        const reason = mainParts[1] || '';
                        
                        const parts = issueContent.split(' → ');
                        const errorPart = parts[0] || '';
                        const suggestionPart = parts[1] || '';
                        
                        const categoryMatch = errorPart.match(/^([^:]+):\s*(.+)/);
                        const category = categoryMatch ? categoryMatch[1] : 'Issue';
                        const errorText = categoryMatch ? categoryMatch[2] : errorPart;
                        
                        const isApplied = appliedSuggestions.has(index);

                        return (
                          <div key={index} style={{
                            padding: '16px',
                            border: `2px solid ${isApplied ? '#20b2aa' : '#e9ecef'}`,
                            borderRadius: '8px',
                            backgroundColor: isApplied ? '#f0fffe' : 'white',
                            opacity: isApplied ? 0.8 : 1
                          }}>
                            {/* Category Badge */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '10px'
                            }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: 
                                  category.toLowerCase().includes('spelling') ? '#dc3545' :
                                  category.toLowerCase().includes('style') ? '#ffc107' :
                                  category.toLowerCase().includes('grammar') ? '#28a745' :
                                  category.toLowerCase().includes('legal') ? '#6f42c1' :
                                  category.toLowerCase().includes('clarity') ? '#17a2b8' :
                                  category.toLowerCase().includes('punctuation') ? '#fd7e14' :
                                  '#6c757d',
                                color: 'white'
                              }}>
                                {category}
                              </span>
                              {isApplied && (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: '#20b2aa',
                                  color: 'white'
                                }}>
                                  ✓ Applied
                                </span>
                              )}
                            </div>
                            
                            {/* Error Text */}
                            <div style={{
                              marginBottom: '8px',
                              fontSize: '14px'
                            }}>
                              <strong style={{ color: '#495057' }}>Found: </strong>
                              <span style={{
                                backgroundColor: '#fff5f5',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                color: '#721c24',
                                fontFamily: 'monospace'
                              }}>
                                {errorText}
                              </span>
                            </div>
                            
                            {/* Suggestion */}
                            {suggestionPart && (
                              <div style={{
                                marginBottom: '12px',
                                fontSize: '14px'
                              }}>
                                <strong style={{ color: '#495057' }}>Suggest: </strong>
                                <span style={{
                                  backgroundColor: '#f0fff4',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  color: '#1e7e34',
                                  fontFamily: 'monospace'
                                }}>
                                  {suggestionPart}
                                </span>
                              </div>
                            )}
                            
                            {/* Reasoning */}
                            {reason && (
                              <div style={{
                                marginBottom: '12px',
                                padding: '10px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '6px',
                                borderLeft: '4px solid #007bff'
                              }}>
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  color: '#007bff',
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  💡 Why this change?
                                </div>
                                <div style={{
                                  fontSize: '13px',
                                  lineHeight: '1.4',
                                  color: '#495057'
                                }}>
                                  {reason}
                                </div>
                              </div>
                            )}
                            
                            {/* Apply Button */}
                            {!isApplied && (
                              <button
                                onClick={() => handleApplySuggestion(index)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  backgroundColor: '#20b2aa',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px'
                                }}
                              >
                                ✓ Apply Suggestion
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      color: '#28a745',
                      paddingTop: '60px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '15px' }}>✨</div>
                      <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>No issues found!</p>
                      <p style={{ fontSize: '14px', color: '#6c757d', marginTop: '5px' }}>
                        Your document looks great.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Viewer */}
      <LogViewer
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        user={user}
        currentDocument={fileName}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Bottom Prompt Bar */}
      <PromptBar
        onSendPrompt={handleAnalyze}
        isAnalyzing={loading}
        user={user}
        fileName={fileName}
      />

      {/* Projects Manager Modal */}
      <ProjectsManager
        username={user}
        isVisible={showProjects}
        onClose={() => setShowProjects(false)}
        onSelectDocument={handleSelectDocument}
      />
    </div>
  );
}

export default App;
