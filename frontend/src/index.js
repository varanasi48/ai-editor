import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Wait for DOM to be ready and mount React
function mountReactApp() {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found! Creating one...');
    // Create root element if it doesn't exist
    const newRoot = document.createElement('div');
    newRoot.id = 'root';
    document.body.appendChild(newRoot);
    
    // Try again with the newly created element
    const createdRoot = document.getElementById('root');
    if (createdRoot) {
      const root = ReactDOM.createRoot(createdRoot);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }
  } else {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

// Ensure DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountReactApp);
} else {
  // DOM is already loaded
  mountReactApp();
}
