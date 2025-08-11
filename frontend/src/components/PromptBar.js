import React, { useState } from 'react';

const PromptBar = ({ onSendPrompt, isAnalyzing, user, fileName }) => {
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Predefined prompt templates
  const promptTemplates = [
    {
      name: "Legal Document Review",
      prompt: "Review this document and find specific text that needs fixing. Give me exact replacements for spelling, grammar, legal terminology, and clarity issues."
    },
    {
      name: "Academic Paper",
      prompt: "Make this document more legally precise. Find weak language, informal terms, and ambiguous phrases that need stronger legal wording."
    },
    {
      name: "Business Communication", 
      prompt: "Polish this document to professional standards. Fix formatting, tone, and language to make it sound more authoritative and credible."
    },
    {
      name: "Technical Documentation",
      prompt: "Improve the clarity and logical flow. Find confusing sentences, unclear terms, and awkward phrasing that need to be rewritten."
    },
    {
      name: "Creative Writing",
      prompt: "What are the key obligations, rights, and deadlines I should know about? Explain the most important parts."
    },
    {
      name: "General Analysis",
      prompt: "What potential problems, loopholes, or risks do you see in this document? What should I be concerned about?"
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim() && !isAnalyzing) {
      onSendPrompt(prompt.trim());
      setPrompt('');
      setIsExpanded(false);
    }
  };

  const applyTemplate = (templatePrompt) => {
    setPrompt(templatePrompt);
    setIsExpanded(true);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderTop: '2px solid #e9ecef',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
      zIndex: 100,
      transition: 'all 0.3s ease'
    }}>
      {/* Expand/Collapse Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '8px'
      }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '20px 20px 0 0',
            padding: '6px 20px',
            fontSize: '12px',
            color: '#6c757d',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🤖 AI Assistant {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          padding: '15px 20px 10px',
          borderTop: '1px solid #f0f0f0'
        }}>
          {/* Quick Templates */}
          <div style={{
            marginBottom: '15px'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#495057',
              marginBottom: '8px'
            }}>
              📝 Quick Templates:
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {promptTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => applyTemplate(template.prompt)}
                  disabled={isAnalyzing}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: '#e9ecef',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    color: '#495057',
                    opacity: isAnalyzing ? 0.6 : 1
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Prompt Input */}
      <div style={{
        padding: isExpanded ? '0 20px 20px' : '15px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* User Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 'fit-content'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#007bff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {user?.charAt(0).toUpperCase() || 'U'}
          </div>
          {fileName && (
            <div style={{
              fontSize: '11px',
              color: '#6c757d',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              📄 {fileName}
            </div>
          )}
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask questions or request specific fixes (e.g., 'Fix grammar issues' or 'What are my obligations?')"
            disabled={isAnalyzing}
            style={{
              flex: 1,
              padding: '10px 15px',
              border: '2px solid #e9ecef',
              borderRadius: '25px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: isAnalyzing ? '#f8f9fa' : 'white',
              color: isAnalyzing ? '#6c757d' : '#495057',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => !isAnalyzing && (e.target.style.borderColor = '#007bff')}
            onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
          />
          
          {prompt.trim() && (
            <button
              type="button"
              onClick={() => {
                setPrompt('');
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Clear prompt"
            >
              ✕ Clear
            </button>
          )}
          
          <button
            type="submit"
            disabled={!prompt.trim() || isAnalyzing}
            style={{
              padding: '10px 20px',
              backgroundColor: isAnalyzing ? '#6c757d' : (prompt.trim() ? '#28a745' : '#e9ecef'),
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: (prompt.trim() && !isAnalyzing) ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              minWidth: 'fit-content',
              transition: 'all 0.2s'
            }}
          >
            {isAnalyzing ? '🔄' : '�'} 
            {isAnalyzing ? 'Working...' : 'Fix & Analyze'}
          </button>
        </form>

        {/* Minimize Button */}
        {isExpanded && (
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: '1px solid #dee2e6',
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#6c757d',
              fontSize: '12px'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div style={{
        padding: '5px 20px',
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #e9ecef',
        fontSize: '11px',
        color: '#6c757d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          � Request specific fixes or ask questions about your document
        </span>
        <span>
          {fileName ? `Working on: ${fileName}` : 'Upload a document to start'}
        </span>
      </div>
    </div>
  );
};

export default PromptBar;
