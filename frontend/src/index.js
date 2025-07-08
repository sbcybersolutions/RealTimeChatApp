// frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client'; // Use /client for React 18+
import './index.css'; // Keep if you want some global styles
import App from './App';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
