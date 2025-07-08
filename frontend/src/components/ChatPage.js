// frontend/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import io from 'socket.io-client'; // Import the socket.io client
import axios from 'axios'; // For fetching channels via HTTP

const SOCKET_SERVER_URL = 'https://realtimechatapp-pdil.onrender.com/'; // Our backend Socket.io URL

function ChatPage({ isAuthenticated, onLogout }) {
  const navigate = useNavigate();

  const [channels, setChannels] = useState([]); // List of available channels
  const [currentChannel, setCurrentChannel] = useState(''); // The channel user is currently in
  const [messages, setMessages] = useState([]); // Messages for the current channel
  const [newMessage, setNewMessage] = useState(''); // Input for new message
  const [onlineUsers, setOnlineUsers] = useState([]); // Users online in the current channel

  // Refs for auto-scrolling chat and holding socket instance
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]); // This useEffect depends on isAuthenticated and navigate


  // Connect to Socket.io and fetch channels on component mount
  // This is the useEffect you asked to fix.
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Fetch channels via HTTP API first
    const fetchChannels = async () => {
      try {
        const res = await axios.get(`${SOCKET_SERVER_URL}/api/channels`);
        setChannels(res.data);
        // Automatically join the first channel if available
        if (res.data.length > 0) {
          const defaultChannel = res.data[0].name;
          setCurrentChannel(defaultChannel);
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
        // Handle error, e.g., show a message to the user
      }
    };

    fetchChannels();

    // Initialize Socket.io connection
    socketRef.current = io(SOCKET_SERVER_URL, {
      auth: {
        token: token, // Send JWT for authentication
      },
    });

    // --- Socket.io Event Listeners ---

    // General connection events
    socketRef.current.on('connect', () => {
      console.log('Connected to Socket.io server!');
      if (currentChannel) {
        socketRef.current.emit('joinChannel', currentChannel);
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from Socket.io server!');
      setOnlineUsers([]);
    });

    socketRef.current.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error.message);
        if (error.message.includes('Authentication error')) {
            alert('Authentication failed. Please log in again.');
            handleLogout(); // This is the function that was missing!
        }
    });

    // Receive message history for a channel (sent on joinChannel)
    socketRef.current.on('messageHistory', (history) => {
      setMessages(history);
    });

    // Receive a new message
    socketRef.current.on('receiveMessage', (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // User joined a channel
    socketRef.current.on('userJoined', ({ userId, username, channel }) => {
      if (channel === currentChannel) {
        setOnlineUsers((prevUsers) => {
          if (!prevUsers.some(u => u.id === userId)) {
            return [...prevUsers, { id: userId, username }];
          }
          return prevUsers;
        });
      }
    });

    // User left a channel
    socketRef.current.on('userLeft', ({ userId, username, channel }) => {
      if (channel === currentChannel) {
        setOnlineUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
      }
    });

    // Update online users list (sent on joinChannel and on updates)
    socketRef.current.on('onlineUsersUpdate', ({ channel, users }) => {
        if (channel === currentChannel) {
            setOnlineUsers(users);
        }
    });

    // Handle generic errors from backend
    socketRef.current.on('error', (errorMessage) => {
      console.error('Socket error from server:', errorMessage);
      alert(`Server error: ${errorMessage}`);
    });

    // Cleanup on unmount or authentication change
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // The dependency array:
  }, [isAuthenticated, token, navigate, currentChannel, handleLogout]); // <-- This is the fixed line!

  // Scroll to bottom of messages whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // Define handleLogout using useCallback so it's a stable function reference
  const handleLogout = useCallback(() => {
      if (socketRef.current) {
        socketRef.current.disconnect(); // Disconnect socket on logout
      }
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      if (onLogout) {
        onLogout(); // Update parent authentication state
      }
      navigate('/login');
  }, [navigate, onLogout, socketRef]); // Add all variables/functions used inside handleLogout as its dependencies

  const handleJoinChannel = (channelName) => {
    if (socketRef.current && socketRef.current.connected) {
      setCurrentChannel(channelName);
      setMessages([]); // Clear messages when switching channels
      setOnlineUsers([]); // Clear online users when switching channels
      socketRef.current.emit('joinChannel', channelName);
      console.log(`Attempting to join channel: ${channelName}`);
    } else {
      console.error('Socket not connected, cannot join channel.');
      alert('Socket connection error. Please refresh and try again.');
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socketRef.current && socketRef.current.connected && currentChannel) {
      socketRef.current.emit('sendMessage', { channel: currentChannel, content: newMessage.trim() });
      setNewMessage(''); // Clear input field
    }
  };

  if (!isAuthenticated) {
    return null; // Will be redirected by useEffect
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.heading}>Real-Time Chat</h1>
        <div style={styles.userInfo}>
          <span style={styles.usernameDisplay}>Logged in as: {username}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
          <Link to="/profile" style={styles.profileLink}>Profile</Link>
        </div>
      </header>

      <div style={styles.mainContent}>
        {/* Channel List Sidebar */}
        <div style={styles.channelList}>
          <h3 style={styles.channelListTitle}>Channels</h3>
          {channels.length === 0 && <p style={{ textAlign: 'center', fontSize: '0.9em', color: '#666' }}>No channels found. Create some on backend!</p>}
          {channels.map((channel) => (
            <button
              key={channel._id}
              onClick={() => handleJoinChannel(channel.name)}
              style={{
                ...styles.channelButton,
                backgroundColor: currentChannel === channel.name ? '#007bff' : '#f0f0f0',
                color: currentChannel === channel.name ? 'white' : '#333',
              }}
            >
              # {channel.name}
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <div style={styles.chatArea}>
          <h3 style={styles.chatHeader}>
            {currentChannel ? `# ${currentChannel}` : 'Select a Channel'}
          </h3>
          <div style={styles.messagesContainer}>
            {messages.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No messages yet. Start chatting!</p>}
            {messages.map((msg, index) => (
              <div key={msg._id || index} style={{ ...styles.message, alignSelf: msg.senderUsername === username ? 'flex-end' : 'flex-start' }}>
                <strong style={styles.messageSender}>{msg.senderUsername}:</strong> {msg.content}
                <span style={styles.messageTimestamp}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
            <div ref={messagesEndRef} /> {/* For auto-scrolling */}
          </div>

          {currentChannel && (
            <form onSubmit={handleSendMessage} style={styles.messageForm}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                style={styles.messageInput}
                required
              />
              <button type="submit" style={styles.sendMessageButton}>Send</button>
            </form>
          )}
        </div>

        {/* Online Users Sidebar */}
        <div style={styles.onlineUsersList}>
          <h3 style={styles.onlineUsersTitle}>Online Users ({onlineUsers.length})</h3>
          <ul style={styles.onlineUsersUl}>
            {onlineUsers.map((user) => (
              <li key={user.id} style={styles.onlineUserItem}>
                • {user.username} {user.id === userId && '(You)'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#343a40',
    color: 'white',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  heading: {
    margin: 0,
    fontSize: '24px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
  },
  usernameDisplay: {
    marginRight: '15px',
    fontSize: '16px',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '8px 15px',
    borderRadius: '5px',
    cursor: 'pointer',
    marginRight: '10px',
  },
  profileLink: {
    color: '#007bff',
    textDecoration: 'none',
    backgroundColor: 'white',
    padding: '8px 15px',
    borderRadius: '5px',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  channelList: {
    width: '200px',
    backgroundColor: '#e9ecef',
    padding: '20px',
    borderRight: '1px solid #dee2e6',
    overflowY: 'auto',
  },
  channelListTitle: {
    color: '#343a40',
    marginBottom: '15px',
    borderBottom: '1px solid #adb5bd',
    paddingBottom: '10px',
  },
  channelButton: {
    width: '100%',
    padding: '10px 15px',
    marginBottom: '8px',
    border: '1px solid #adb5bd',
    borderRadius: '5px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s, color 0.2s, border-color 0.2s',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    position: 'relative',
  },
  chatHeader: {
    backgroundColor: '#f8f9fa',
    padding: '15px 20px',
    borderBottom: '1px solid #dee2e6',
    margin: 0,
    fontSize: '20px',
    color: '#343a40',
  },
  messagesContainer: {
    flex: 1,
    padding: '15px 20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  message: {
    backgroundColor: '#e2f0ff',
    padding: '10px 15px',
    borderRadius: '15px',
    marginBottom: '10px',
    maxWidth: '70%',
    wordWrap: 'break-word',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  messageSender: {
    fontWeight: 'bold',
    marginRight: '5px',
    color: '#0056b3',
  },
  messageTimestamp: {
    fontSize: '0.7em',
    color: '#777',
    marginLeft: '10px',
  },
  messageForm: {
    display: 'flex',
    padding: '15px 20px',
    borderTop: '1px solid #dee2e6',
    backgroundColor: '#f8f9fa',
  },
  messageInput: {
    flex: 1,
    padding: '10px 15px',
    border: '1px solid #ced4da',
    borderRadius: '20px',
    marginRight: '10px',
    fontSize: '16px',
  },
  sendMessageButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s',
  },
  onlineUsersList: {
    width: '180px',
    backgroundColor: '#e9ecef',
    padding: '20px',
    borderLeft: '1px solid #dee2e6',
    overflowY: 'auto',
  },
  onlineUsersTitle: {
    color: '#343a40',
    marginBottom: '15px',
    borderBottom: '1px solid #adb5bd',
    paddingBottom: '10px',
  },
  onlineUsersUl: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  onlineUserItem: {
    marginBottom: '8px',
    fontSize: '15px',
    color: '#333',
  },
};

export default ChatPage;