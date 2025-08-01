import React, { useState, useRef } from "react";
import './App.css';

function App() {
  // Use environment variable for API URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
  
  const [pdfText, setPdfText] = useState("Upload a PDF or DOCX file to see its content here.");
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [editableText, setEditableText] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);
  const [logContent, setLogContent] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [editableAnalysis, setEditableAnalysis] = useState("");
  const [renderKey, setRenderKey] = useState(0);
  const editableParagraphRef = useRef(null);

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

  const handleAnalyze = async () => {
    if (!editableText || editableText === "Upload a PDF or DOCX file to see its content here.") {
      alert("Please enter or upload some text to analyze.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: editableText }),
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Analysis response:', data);
      
      setAnalysisResults(data);
      setEditableText(data.highlighted_text);
      setHasAnalyzed(true);
      setAppliedSuggestions(new Set());
      
    } catch (error) {
      console.error("Error analyzing text:", error);
      alert(`Error analyzing document: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (issueIndex) => {
    if (!analysisResults || !analysisResults.issues_found[issueIndex]) return;
    
    const issue = analysisResults.issues_found[issueIndex];
    const parts = issue.split(' → ');
    if (parts.length === 2) {
      const errorPart = parts[0];
      const suggestion = parts[1];
      
      // Extract the actual text to replace (after the category prefix)
      const colonIndex = errorPart.indexOf(': ');
      const originalText = colonIndex > -1 ? errorPart.substring(colonIndex + 2) : errorPart;
      
      console.log('Trying to replace:', originalText, 'with:', suggestion);
      
      // Get current text from the editable element (use textContent for plain text matching)
      const currentElement = editableParagraphRef.current;
      if (!currentElement) return;
      
      const currentText = currentElement.textContent || currentElement.innerText || "";
      const currentHTML = currentElement.innerHTML || "";
      
      console.log('Current text contains original?', currentText.includes(originalText));
      console.log('Original text length:', originalText.length);
      console.log('Current text length:', currentText.length);
      console.log('Original text:', JSON.stringify(originalText));
      console.log('Current text sample:', JSON.stringify(currentText.substring(0, 100)));
      
      // Try exact match first
      if (currentText.includes(originalText)) {
        const highlightedSuggestion = `<span style="background-color: #20b2aa; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;" title="Applied: ${originalText} → ${suggestion}">${suggestion}</span>`;
        const regex = new RegExp(originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const updatedHTML = currentHTML.replace(regex, highlightedSuggestion);
        
        currentElement.innerHTML = updatedHTML;
        setEditableText(updatedHTML);
        
        // Mark as applied
        setAppliedSuggestions(prev => new Set([...prev, issueIndex]));
        logChange(errorPart, originalText, suggestion);
        console.log('Applied suggestion successfully');
      } else {
        console.log('Text not found, adding as note');
        // For suggestions where exact text isn't found, add as a note
        const noteText = `✓ Applied: ${suggestion}`;
        const updatedHTML = currentHTML + `<br><span style="background-color: #20b2aa; color: white; padding: 4px 8px; border-radius: 4px; font-style: italic; display: inline-block; margin: 4px 0;">${noteText}</span>`;
        
        currentElement.innerHTML = updatedHTML;
        setEditableText(updatedHTML);
        setAppliedSuggestions(prev => new Set([...prev, issueIndex]));
        logChange("Note", "general", suggestion);
      }
    }
  };

  const logChange = async (category, originalText, suggestedText) => {
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
          timestamp: new Date().toISOString()
        }),
      });
    } catch (error) {
      console.error("Error logging change:", error);
    }
  };

  const handleViewLog = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/get-log`);
      const data = await response.json();
      
      if (data.status === "success") {
        setLogContent(data.log_content);
        setShowLogModal(true);
      } else {
        alert("Failed to retrieve log: " + data.message);
      }
    } catch (error) {
      console.error("Error fetching log:", error);
      alert("Error fetching log. Please try again.");
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Top Navigation Bar */}
      <div style={{ 
        backgroundColor: 'white',
        borderBottom: '1px solid #dee2e6',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          � AI Editor
        </h1>
        <button 
          onClick={handleViewLog}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,123,255,0.2)'
          }}
        >
          📋 View Logs
        </button>
      </div>

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
        
        {/* Left Panel - Original Document */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', paddingBottom: '10px' }}>
            {/* File Upload Section */}
            <div style={{
              marginBottom: '20px',
              padding: '20px',
              border: '2px dashed #dee2e6',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: '#f8f9fa'
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
                gap: '10px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: uploading ? '#007bff' : '#6c757d',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: 'white'
                }}>
                  {uploading ? '⏳' : '📄'}
                </div>
                <span style={{
                  fontSize: '16px',
                  color: '#495057',
                  fontWeight: '500'
                }}>
                  {uploading ? "Uploading..." : "Upload PDF/DOCX"}
                </span>
                {fileName && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '5px'
                  }}>
                    <span style={{ fontSize: '20px' }}>📄</span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#007bff',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {fileName}
                    </span>
                  </div>
                )}
              </label>
            </div>

            {/* Analyze Button */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={handleAnalyze}
                disabled={loading || pdfText === "Upload a PDF or DOCX file to see its content here."}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: loading ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 2px 4px rgba(40,167,69,0.2)'
                }}
              >
                {loading ? '🔄 Analyzing...' : '🔍 Analyze Document'}
              </button>
            </div>

            <h2 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#333',
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📄 Original Document
            </h2>
          </div>
          
          <div style={{
            flex: 1,
            margin: '0 20px 20px',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#495057',
            maxHeight: 'calc(100vh - 300px)'
          }}>
            {pdfText}
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
                        const parts = issue.split(' → ');
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

      {/* Log Modal */}
      {showLogModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '90%',
            maxHeight: '80%',
            overflow: 'hidden',
            minWidth: '600px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '15px',
              borderBottom: '2px solid #dee2e6'
            }}>
              <h2 style={{ 
                margin: 0,
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                📋 Changes Log
              </h2>
              <button
                onClick={() => setShowLogModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              overflow: 'auto',
              maxHeight: '500px',
              fontSize: '13px',
              fontFamily: 'Consolas, Monaco, monospace',
              lineHeight: '1.4',
              color: '#495057'
            }}>
              {logContent || "No changes have been logged yet."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
