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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-canvas)' }}>
      <div style={{ background: 'var(--bg-column)', padding: '2.5rem', borderRadius: 'var(--radius-modal)', width: '380px', border: '1px solid var(--border-ui)', boxShadow: 'var(--shadow-modal)' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--text-main)', textTransform: 'uppercase' }}>
          {isLoginMode ? 'Welcome Back' : 'Create Account'}
        </h2>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {authError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{authError}</p>}
          <input 
            type="text" 
            placeholder="Username" 
            value={authUsername} 
            onChange={e => setAuthUsername(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-ui)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.925rem', outline: 'none', fontFamily: 'var(--font-body)' }} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={authPassword} 
            onChange={e => setAuthPassword(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-ui)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.925rem', outline: 'none', fontFamily: 'var(--font-body)' }} 
          />
          <button type="submit" className="btn-primary" style={{ padding: '0.8rem', fontSize: '0.925rem' }}>
            {isLoginMode ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p 
          style={{ marginTop: '1.5rem', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem', transition: 'color 0.2s ease' }} 
          onClick={() => setIsLoginMode(!isLoginMode)} 
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'} 
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          {isLoginMode ? "Don't have an account? Register" : "Already have an account? Login"}
        </p>
      </div>
    </div>
  );
};
