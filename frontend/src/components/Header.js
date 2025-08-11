import React from 'react';

const Header = ({ user, onLogout, onViewLog, onShowProjects, appVersion }) => {
  return (
    <div style={{ 
      backgroundColor: 'white',
      borderBottom: '1px solid #dee2e6',
      padding: '12px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Left side - Logo and Version */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          🤖 insync-edits
          <span style={{
            fontSize: '12px',
            color: '#6c757d',
            fontWeight: 'normal',
            marginLeft: '10px'
          }}>
            {appVersion}
          </span>
        </h1>
      </div>

      {/* Right side - User info and actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {/* User Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '20px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#007bff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {user.charAt(0).toUpperCase()}
          </div>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '500',
            color: '#495057'
          }}>
            {user}
          </span>
        </div>

        {/* My Documents Button */}
        <button 
          onClick={onShowProjects}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(40,167,69,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          📁 My Documents
        </button>

        {/* View Logs Button */}
        <button 
          onClick={onViewLog}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,123,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          📋 View Logs
        </button>

        {/* Logout Button */}
        <button 
          onClick={onLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(220,53,69,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
};

export default Header;
