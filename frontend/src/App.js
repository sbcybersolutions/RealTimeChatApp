// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import ChatPage from './components/ChatPage';
import Profile from './components/Profile';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for token in local storage on initial load
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Optional: If on a non-auth page and token exists, redirect to chat
      if (window.location.pathname === '/' || window.location.pathname === '/register') {
        navigate('/chat');
      }
    } else {
        // If no token, ensure user is on login/register page
        if (window.location.pathname !== '/register' && window.location.pathname !== '/login') {
            navigate('/login');
        }
    }
  }, [navigate]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    navigate('/chat'); // Redirect to chat after successful login
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    navigate('/login'); // Redirect to login after logout
  };

  return (
    <div className="App">
      <Routes>
        <Route path="/register" element={<Register />} />
        {/* Pass handleLoginSuccess prop to Login component */}
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        {/* Pass isAuthenticated and handleLogout to ChatPage */}
        <Route
          path="/chat"
          element={
            isAuthenticated ? (
              <ChatPage isAuthenticated={isAuthenticated} onLogout={handleLogout} />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} /> // Redirect to login if not authenticated
            )
          }
        />
        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <Profile />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} /> // Redirect to login if not authenticated
            )
          }
        />
        {/* Default route for non-authenticated users */}
        <Route path="/" element={isAuthenticated ? <ChatPage isAuthenticated={isAuthenticated} onLogout={handleLogout} /> : <Login onLoginSuccess={handleLoginSuccess} />} />
      </Routes>
    </div>
  );
}

export default App;