// frontend/src/components/Profile.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Profile() {
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login'); // Redirect if no token
        return;
      }

      try {
        const config = {
          headers: {
            Authorization: `Bearer ${token}`, // Attach the JWT to the Authorization header
          },
        };
        const response = await axios.get('https://realtimechatapp-pdil.onrender.com/api/users/profile', config);
        setProfileData(response.data);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(err.response?.data?.message || 'Failed to load profile data.');
        // If token is invalid or expired, log out and redirect
        if (err.response && err.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            navigate('/login');
        }
      }
    };

    fetchProfile();
  }, [navigate]);

  if (error) return <div style={styles.error}>Error: {error} <Link to="/login">Login again</Link></div>;
  if (!profileData) return <div style={styles.loading}>Loading profile...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>User Profile</h2>
      <p><strong>Username:</strong> {profileData.username}</p>
      <p><strong>Message from Backend:</strong> {profileData.message}</p>
      <button onClick={() => navigate('/chat')} style={styles.backButton}>Back to Chat</button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#e0e0e0',
    fontFamily: 'Arial, sans-serif',
  },
  heading: {
    color: '#444',
    marginBottom: '20px',
  },
  loading: {
    fontSize: '18px',
    color: '#777',
  },
  error: {
    fontSize: '18px',
    color: 'red',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '20px',
  }
};

export default Profile;