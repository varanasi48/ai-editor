import React, { useState, useEffect } from 'react';

const LogViewer = ({ 
  isOpen, 
  onClose, 
  user, 
  currentDocument, 
  apiBaseUrl 
}) => {
  const [logContent, setLogContent] = useState("");
  const [viewMode, setViewMode] = useState("current"); // "current", "all", "summary"
  const [userDocuments, setUserDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (currentDocument && currentDocument !== "untitled") {
        setViewMode("current");
        loadCurrentDocumentLog();
      } else {
        setViewMode("summary");
        loadUserSummary();
      }
    }
  }, [isOpen, currentDocument, user]);

  const loadCurrentDocumentLog = async () => {
    if (!currentDocument || !user) return;
    
    setLoading(true);
    try {
      const encodedDocName = encodeURIComponent(currentDocument);
      const encodedUser = encodeURIComponent(user);
      const response = await fetch(`${apiBaseUrl}/get-user-document-log/${encodedUser}/${encodedDocName}`);
      const data = await response.json();
      
      if (data.status === "success") {
        setLogContent(data.log_content);
      } else {
        setLogContent(`No changes logged for "${currentDocument}" yet.`);
      }
    } catch (error) {
      setLogContent("Error loading document log.");
    } finally {
      setLoading(false);
    }
  };

  const loadUserSummary = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/get-user-logs/${encodeURIComponent(user)}`);
      const data = await response.json();
      
      if (data.status === "success") {
        setUserDocuments(data.documents);
        
        let content = `📊 Document Summary for ${user}\n`;
        content += `📚 Total Documents: ${data.total_documents}\n\n`;
        
        if (data.documents.length > 0) {
          content += "📋 Recent Activity:\n";
          content += "=====================================\n";
          
          data.documents.forEach((doc, index) => {
            const lastModified = new Date(doc.last_modified * 1000).toLocaleString();
            content += `${index + 1}. ${doc.document_name}\n`;
            content += `   📝 Changes: ${doc.total_entries}\n`;
            content += `   📅 Last Modified: ${lastModified}\n\n`;
          });
          
          content += "\n💡 Select a document above to view its detailed change log.";
        } else {
          content += "No documents have been edited yet.\n";
          content += "Upload and analyze a document to start tracking changes!";
        }
        
        setLogContent(content);
      }
    } catch (error) {
      setLogContent("Error loading user summary.");
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificDocumentLog = async (docName) => {
    setLoading(true);
    setSelectedDocument(docName);
    
    try {
      const encodedDocName = encodeURIComponent(docName);
      const encodedUser = encodeURIComponent(user);
      const response = await fetch(`${apiBaseUrl}/get-user-document-log/${encodedUser}/${encodedDocName}`);
      const data = await response.json();
      
      if (data.status === "success") {
        setLogContent(data.log_content);
      } else {
        setLogContent(`No changes found for "${docName}".`);
      }
    } catch (error) {
      setLogContent("Error loading document log.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
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
        borderRadius: '12px',
        padding: '0',
        maxWidth: '95%',
        maxHeight: '90%',
        minWidth: '800px',
        minHeight: '600px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px 24px',
          borderBottom: '2px solid #e9ecef',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h2 style={{ 
              margin: 0,
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              📋 Change Logs
            </h2>
            <button
              onClick={onClose}
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

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '10px'
          }}>
            {currentDocument && currentDocument !== "untitled" && (
              <button
                onClick={() => {
                  setViewMode("current");
                  setSelectedDocument(null);
                  loadCurrentDocumentLog();
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: viewMode === "current" ? '#007bff' : '#e9ecef',
                  color: viewMode === "current" ? 'white' : '#495057',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                📄 Current Document
              </button>
            )}
            
            <button
              onClick={() => {
                setViewMode("summary");
                setSelectedDocument(null);
                loadUserSummary();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === "summary" ? '#007bff' : '#e9ecef',
                color: viewMode === "summary" ? 'white' : '#495057',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📊 All Documents
            </button>
          </div>

          {/* Document Selector */}
          {viewMode === "summary" && userDocuments.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '15px'
            }}>
              {userDocuments.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => loadSpecificDocumentLog(doc.document_name)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: selectedDocument === doc.document_name ? '#28a745' : '#f8f9fa',
                    color: selectedDocument === doc.document_name ? 'white' : '#495057',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  📄 {doc.document_name} ({doc.total_entries})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          padding: '20px 24px',
          overflow: 'auto',
          backgroundColor: 'white'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: '#6c757d'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                <div>Loading logs...</div>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              fontSize: '13px',
              fontFamily: 'Consolas, Monaco, monospace',
              lineHeight: '1.5',
              color: '#495057',
              whiteSpace: 'pre-wrap',
              minHeight: '400px'
            }}>
              {logContent || "No logs available."}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '15px 24px',
          borderTop: '1px solid #dee2e6',
          backgroundColor: '#f8f9fa',
          borderRadius: '0 0 12px 12px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          💡 All changes are automatically logged and stored separately for each document and user.
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
