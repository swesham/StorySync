import { useState } from 'react';
import './Signup.css';

function Signup() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.email.split('@')[0],
          email: formData.email,
          password: formData.password,
          password2: formData.confirmPassword,
          first_name: formData.fullName.split(' ')[0],
          last_name: formData.fullName.split(' ').slice(1).join(' ') || '',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && (data.tokens?.access || data.access)) {
        localStorage.setItem('access_token', data.tokens?.access || data.access);
        localStorage.setItem('refresh_token', data.tokens?.refresh || data.refresh || '');
        sessionStorage.setItem('from_login', 'true');
        const isAdmin = !!(data.user && (data.user.is_staff || data.user.is_superuser));
        sessionStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
        alert('Registration successful!');
        window.location.reload();
      } else {
        alert(data.error || data.detail || (data.username && data.username[0]) || 'Registration failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Cannot reach server. Make sure Django is running.');
    }
  };

  return (
    <div className="auth-container">
      {}
      <div className="auth-background"></div>
      
      {}
      <div className="auth-card">
        <h1 className="auth-title">StorySync</h1>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            placeholder="Full name"
            value={formData.fullName}
            onChange={handleChange}
            className="auth-input"
            required
          />
          
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="auth-input"
            required
          />
          
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className="auth-input"
            required
          />
          
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="auth-input"
            required
          />
          
          <button type="submit" className="auth-button">
            Register
          </button>
        </form>
      </div>
    </div>
  );
}

export default Signup;
