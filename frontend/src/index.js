import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Or your main CSS file
import App from './App';
// Any other global imports like reportWebVitals

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);