import { useState } from 'react';
import './Login.css';
import '../inline-message.css';

function Login({ onNavigate }) {
  const [formData, setFormData] = useState({
    username_or_email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  const handleChange = (e) => {
    setFormMessage('');
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage('');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    try {
      const response = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username_or_email: formData.username_or_email,
          password: formData.password,
        }),
      });
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');
      const data = isJson ? (await response.json().catch(() => ({}))) : {};
      if (response.ok && (data.tokens?.access || data.access)) {
        localStorage.setItem('access_token', data.tokens?.access || data.access);
        localStorage.setItem('refresh_token', data.tokens?.refresh || data.refresh || '');
        if (data.user?.username) localStorage.setItem('username', data.user.username);
        sessionStorage.setItem('from_login', 'true');
        const isAdmin = !!(data.user && (data.user.is_staff || data.user.is_superuser));
        sessionStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
        window.location.reload();
      } else {
        const msg = data.error || data.detail || (response.ok ? 'Login failed' : `Could not sign in (${response.status}).`);
        setFormMessage(msg);
      }
    } catch (error) {
      console.error('Login error:', error);
      setFormMessage('Cannot reach server. Make sure Django is running.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background"></div>
      <div className="auth-card">
        <h1 className="auth-title">StorySync</h1>
        <form onSubmit={handleSubmit} className="auth-form" autoComplete="on">
          <input
            type="text"
            name="username_or_email"
            autoComplete="username"
            placeholder="Username or Email"
            value={formData.username_or_email}
            onChange={handleChange}
            className="auth-input"
            required
          />
          <div className="password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="auth-input"
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <button type="submit" className="auth-button">Login</button>
          {formMessage ? <p className="inline-form-msg">{formMessage}</p> : null}
        </form>
      </div>
    </div>
  );
}

export default Login;
