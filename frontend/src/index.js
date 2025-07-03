import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import './App.css';

try {
  console.log(`✅ Initializing React app: env=${process.env.NODE_ENV}, timestamp=${new Date().toISOString()}`);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <div role="application" aria-label="Forms Application">
        <App />
      </div>
    </React.StrictMode>
  );
  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ Failed to initialize React app:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
}