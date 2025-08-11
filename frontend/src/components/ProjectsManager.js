import React, { useState, useEffect } from 'react';

const ProjectsManager = ({ username, isVisible, onClose, onSelectDocument }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocumentLog, setSelectedDocumentLog] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (isVisible && username) {
      fetchUserProjects();
    }
  }, [isVisible, username]);

  const fetchUserProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${username}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentLog = async (documentName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${username}/${documentName}/log`);
      if (!response.ok) {
        throw new Error(`Failed to fetch log: ${response.status}`);
      }
      const logData = await response.json();
      setSelectedDocumentLog(logData);
      setShowLogModal(true);
    } catch (err) {
      console.error('Error fetching document log:', err);
      alert(`Error fetching activity log: ${err.message}`);
    }
  };

  const downloadLogFile = async (documentName, fileName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${username}/${documentName}/${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      console.log(`Downloaded log file: ${fileName}`);
    } catch (err) {
      console.error('Error downloading log file:', err);
      alert(`Error downloading log file: ${err.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const formatDate = (isoDate) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isVisible) return null;

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
        padding: '24px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid #f0f0f0',
          paddingBottom: '16px'
        }}>
          <h2 style={{
            margin: 0,
            color: '#2c3e50',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            📁 {username}'s Documents
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔄</div>
              Loading projects...
            </div>
          )}

          {error && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#e74c3c'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>❌</div>
              Error: {error}
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#495057' }}>No Documents Yet</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                Upload your first document to get started!
              </p>
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <div>
              <div style={{
                marginBottom: '16px',
                color: '#6c757d',
                fontSize: '14px'
              }}>
                {projects.length} document{projects.length !== 1 ? 's' : ''} found
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {projects.map((project, index) => (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#e9ecef';
                      e.target.style.borderColor = '#007bff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#f8f9fa';
                      e.target.style.borderColor = '#e9ecef';
                    }}
                  >
                    {/* Document Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <h4 style={{
                        margin: 0,
                        color: '#2c3e50',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        📄 {project.document_name}
                      </h4>
                      <div style={{
                        fontSize: '12px',
                        color: '#6c757d'
                      }}>
                        Created: {formatDate(project.created)}
                      </div>
                    </div>

                    {/* Files List */}
                    <div style={{ marginBottom: '12px' }}>
                      {project.files.map((file, fileIndex) => (
                        <div
                          key={fileIndex}
                          onClick={() => {
                            if (file.type === 'log') {
                              downloadLogFile(project.document_name, file.name);
                            }
                          }}
                          title={file.type === 'log' ? 'Click to download activity log' : ''}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            backgroundColor: 'white',
                            borderRadius: '4px',
                            marginBottom: '6px',
                            border: '1px solid #dee2e6',
                            cursor: file.type === 'log' ? 'pointer' : 'default',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (file.type === 'log') {
                              e.target.style.backgroundColor = '#e3f2fd';
                              e.target.style.borderColor = '#17a2b8';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (file.type === 'log') {
                              e.target.style.backgroundColor = 'white';
                              e.target.style.borderColor = '#dee2e6';
                            }
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '16px' }}>
                              {file.type === 'original' ? '📑' : (file.type === 'extracted' ? '📄' : '📋')}
                            </span>
                            <span style={{
                              fontSize: '14px',
                              color: '#495057',
                              fontWeight: file.type === 'original' ? '600' : 'normal'
                            }}>
                              {file.name}
                            </span>
                            {file.type === 'extracted' && (
                              <span style={{
                                fontSize: '10px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '10px'
                              }}>
                                TEXT
                              </span>
                            )}
                            {file.type === 'log' && (
                              <span style={{
                                fontSize: '10px',
                                backgroundColor: '#17a2b8',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '10px'
                              }}>
                                📥 LOG
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#6c757d',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}>
                            <span>{formatFileSize(file.size)}</span>
                            <span>Modified: {formatDate(file.modified)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end'
                    }}>
                      {project.files.find(f => f.type === 'extracted') && (
                        <button
                          onClick={() => {
                            // Find the extracted text file and load it
                            const extractedFile = project.files.find(f => f.type === 'extracted');
                            if (extractedFile) {
                              onSelectDocument(project, extractedFile);
                              onClose();
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          📖 Load Document
                        </button>
                      )}
                      <button
                        onClick={() => fetchDocumentLog(project.document_name)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        📋 View Log
                      </button>
                      {/* Find and download log file */}
                      {project.files.find(f => f.type === 'log') && (
                        <button
                          onClick={() => {
                            const logFile = project.files.find(f => f.type === 'log');
                            if (logFile) {
                              downloadLogFile(project.document_name, logFile.name);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          📥 Download Log
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // Open folder location (for demo, just show alert)
                          alert(`Document location: ${project.path}`);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        📁 Show Path
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#6c757d'
          }}>
            💡 Tip: Upload documents to automatically organize them by user and name
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Activity Log Modal */}
      {showLogModal && selectedDocumentLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }}>
            {/* Log Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #f0f0f0',
              paddingBottom: '16px'
            }}>
              <h3 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '20px',
                fontWeight: '600'
              }}>
                📋 Activity Log: {selectedDocumentLog.document_name}
              </h3>
              <button
                onClick={() => {
                  setShowLogModal(false);
                  setSelectedDocumentLog(null);
                }}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Log Entries */}
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedDocumentLog.log_entries.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6c757d'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                  <p>No activity recorded yet for this document.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedDocumentLog.log_entries.reverse().map((entry, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        backgroundColor: entry.action === 'UPLOAD' ? '#d4edda' : 
                                        entry.action === 'ANALYZE' ? '#d1ecf1' : 
                                        entry.action === 'CHAT' ? '#fff3cd' : '#f8f9fa'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ 
                            backgroundColor: entry.action === 'UPLOAD' ? '#28a745' : 
                                            entry.action === 'ANALYZE' ? '#17a2b8' : 
                                            entry.action === 'CHAT' ? '#ffc107' : '#6c757d',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {entry.action}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: '#6c757d'
                        }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#495057',
                        lineHeight: '1.4'
                      }}>
                        {entry.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Log Footer */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#6c757d'
              }}>
                Total entries: {selectedDocumentLog.total_entries}
              </div>
              <button
                onClick={() => {
                  setShowLogModal(false);
                  setSelectedDocumentLog(null);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsManager;
