import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo credentials - in production, this would be handled by a backend
  const DEMO_USERS = {
    'admin': 'admin123',
    'user': 'user123',
    'demo': 'demo123'
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate API call delay
    setTimeout(() => {
      const { username, password } = credentials;
      
      if (DEMO_USERS[username] && DEMO_USERS[username] === password) {
        // Successful login
        localStorage.setItem('insyncedits_user', JSON.stringify({
          username,
          loginTime: new Date().toISOString()
        }));
        onLogin(username);
      } else {
        setError('Invalid username or password');
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleDemoLogin = () => {
    setCredentials({ username: 'demo', password: 'demo123' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '2px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '18px',
          padding: '40px',
          width: '400px',
          maxWidth: '90vw'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '10px'
            }}>🤖</div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#333',
              margin: '0 0 5px 0'
            }}>
              insync-edits
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#6c757d',
              margin: 0
            }}>
              AI-Powered Document Editor
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#495057',
                marginBottom: '8px'
              }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#495057',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
                border: '1px solid #f5c6cb'
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: isLoading ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'transform 0.2s',
                marginBottom: '20px'
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {isLoading ? '🔄 Signing In...' : '🚀 Sign In'}
            </button>
          </form>

          {/* Demo Login */}
          <div style={{
            borderTop: '1px solid #e9ecef',
            paddingTop: '20px',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#6c757d',
              marginBottom: '15px'
            }}>
              Try the demo:
            </p>
            <button
              onClick={handleDemoLogin}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              🎯 Demo User
            </button>
            <div style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '15px',
              lineHeight: '1.4'
            }}>
              <strong>Demo Accounts:</strong><br />
              admin / admin123<br />
              user / user123<br />
              demo / demo123
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            marginTop: '30px',
            fontSize: '12px',
            color: '#6c757d'
          }}>
            © 2025 insync-edits. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
