import { useState, useEffect } from 'react';
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

const API = '/api';

function EditPreferences({ onBack }) {
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  const token = () => localStorage.getItem('access_token');
  const auth = () => ({ Authorization: `Bearer ${token()}` });
  const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API}/profile/me/`, { headers: auth() })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load your preferences');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const raw = data.interests;
        const list = Array.isArray(raw) ? raw : [];
        setSelectedGenres(GENRE_OPTIONS.filter((g) => list.includes(g)));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSave = async () => {
    const t = token();
    setSaveMessage('');
    if (!t) {
      setSaveMessage('Please log in again.');
      onBack?.();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/profile/update/`, {
        method: 'PATCH',
        headers: json(),
        body: JSON.stringify({ interests: selectedGenres }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.interests?.[0] || 'Could not save preferences');
      }
      onBack?.();
    } catch (e) {
      setSaveMessage(e.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-background" />
        <div className="auth-card auth-card-wide">
          <p className="signup-genre-subtitle">Loading preferences…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-background" />
        <div className="auth-card auth-card-wide">
          <p className="signup-genre-subtitle" style={{ color: '#c00' }}>{error}</p>
          <button type="button" className="auth-button signup-genre-next" onClick={() => onBack?.()}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-background" />
      <div className="auth-card auth-card-wide">
        <h1 className="signup-complete-title">Edit preferences</h1>
        <p className="signup-genre-subtitle">Pick your favorite genres for recommendations</p>
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
        <div className="edit-prefs-actions">
          <button type="button" className="auth-button signup-genre-next edit-prefs-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saveMessage ? <p className="inline-form-msg">{saveMessage}</p> : null}
          <button type="button" className="auth-button edit-prefs-cancel" onClick={() => onBack?.()} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditPreferences;
