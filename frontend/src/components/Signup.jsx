import { useState } from 'react';
import './Signup.css';
import '../inline-message.css';

const GENRE_OPTIONS = [
  'Fiction',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Fantasy',
  'Horror',
  'Biography',
  'History',
  'Self-Help',
  'Comedy',
  'Drama',
  'Action',
  'Documentary',
  'Thriller',
  'Young Adult',
  'Poetry',
];

function Signup() {
  const [step, setStep] = useState('form');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [savingGenres, setSavingGenres] = useState(false);
  const [showPassword, setShowPassword] = useState(false);  
  const [showConfirm, setShowConfirm] = useState(false); 
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [formSubmitMessage, setFormSubmitMessage] = useState('');
  const [genreMessage, setGenreMessage] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const updated = { ...formData, [e.target.name]: e.target.value };
    setFormData(updated);
    if (e.target.name === 'confirmPassword' || e.target.name === 'password') {
      setPasswordMismatch(
        updated.confirmPassword.length > 0 && updated.password !== updated.confirmPassword
      );
    }
  };

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitMessage('');

    if (formData.password !== formData.confirmPassword) {
      setPasswordMismatch(true);
      return;
    }

    setPasswordMismatch(false);

    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
  
    try {
      const response = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: (nameParts[0] + (nameParts[1] ? nameParts[1] : '')).toLowerCase().replace(/\s+/g, ''),
          email: formData.email,
          password: formData.password,
          password2: formData.confirmPassword,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
        }),
      });
  
      const data = await response.json().catch(() => ({}));
  
      if (response.ok && (data.tokens?.access || data.access)) {
        localStorage.setItem('access_token', data.tokens?.access || data.access);
        localStorage.setItem('refresh_token', data.tokens?.refresh || data.refresh || '');
        setStep('genres');
        setSelectedGenres([]);
      } else {

        const extractErrors = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          const messages = [];
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (Array.isArray(val)) messages.push(`${key}: ${val.join(', ')}`);
            else if (typeof val === 'string') messages.push(val);
          }
          return messages.length > 0 ? messages.join('\n') : null;
        };
  
        const errorMsg =
          data.error ||
          data.detail ||
          extractErrors(data) ||
          'Registration failed. Please try again.';
  
        setFormSubmitMessage(errorMsg);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setFormSubmitMessage('Cannot reach server. Make sure Django is running.');
    }
  };

  const handleGenreNext = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setGenreMessage('Session expired. Please sign up again.');
      setStep('form');
      return;
    }
    setGenreMessage('');
    setSavingGenres(true);
    try {
      const res = await fetch('/api/profile/update/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interests: selectedGenres }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not save genres');
      }
      sessionStorage.setItem('from_login', 'true');
      const me = await fetch('/api/profile/me/', { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
        r.ok ? r.json() : {}
      );
      const isAdmin = !!(me.is_staff || me.is_superuser);
      sessionStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
      window.location.reload();
    } catch (e) {
      setGenreMessage(e.message || 'Something went wrong');
    } finally {
      setSavingGenres(false);
    }
  };

  if (step === 'genres') {
    return (
      <div className="auth-container">
        <div className="auth-background" />
        <div className="auth-card auth-card-wide">
          <h1 className="signup-complete-title">Complete Sign Up process</h1>
          <p className="signup-genre-subtitle">Pick favorite Genres</p>
          <div className="signup-genre-grid">
            {GENRE_OPTIONS.map((genre) => (
              <button
                key={genre}
                type="button"
                className={`signup-genre-btn ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                onClick={() => toggleGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="auth-button signup-genre-next"
            onClick={handleGenreNext}
            disabled={savingGenres}
          >
            {savingGenres ? 'Saving…' : 'Next'}
          </button>
          {genreMessage ? <p className="inline-form-msg">{genreMessage}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-background" />

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

            <div className="password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
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

          <div className="password-wrap">
            <input
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="auth-input"
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowConfirm(v => !v)}>
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {passwordMismatch && <p className="password-mismatch">Passwords do not match</p>}

          <button type="submit" className="auth-button">
            Register
          </button>
          {formSubmitMessage ? <p className="inline-form-msg">{formSubmitMessage}</p> : null}
        </form>
      </div>
    </div>
  );
}

export default Signup;
