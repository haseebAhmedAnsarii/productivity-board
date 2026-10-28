import './AuthView.scss';
import React, { useState } from 'react';

interface AuthViewProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error);
        return;
      }
      
      if (!isLoginMode) {
        setIsLoginMode(true);
        setAuthError('Registration successful. Please login.');
        return;
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('authUsername', authUsername);
      onLoginSuccess(data.token, authUsername);
    } catch {
      setAuthError('Failed to connect to server');
    }
  };

  return (
    <div className="auth-view-container">
      <div className="auth-card">
        <h2 className="auth-title">
          {isLoginMode ? 'Welcome Back' : 'Create Account'}
        </h2>
        <form onSubmit={handleAuth} className="auth-form">
          {authError && <p className="auth-error">{authError}</p>}
          <input 
            type="text" 
            placeholder="Username" 
            value={authUsername} 
            onChange={e => setAuthUsername(e.target.value)} 
            className="auth-input"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={authPassword} 
            onChange={e => setAuthPassword(e.target.value)} 
            className="auth-input"
          />
          <button type="submit" className="btn-primary auth-submit-btn">
            {isLoginMode ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p 
          className="auth-toggle-mode"
          onClick={() => setIsLoginMode(!isLoginMode)} 
        >
          {isLoginMode ? "Don't have an account? Register" : "Already have an account? Login"}
        </p>
      </div>
    </div>
  );
};
