import { useEffect, useMemo, useState } from 'react';
import './Clubs.css';
import '../inline-message.css';

function isMemberClub(club) {
  const role = (club?.current_user_role || '').toUpperCase();
  return role === 'ADMIN' || role === 'MEMBER';
}

export default function Clubs({ onOpenClubDiscussion }) {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateClub, setShowCreateClub] = useState(false);
  const [createClubMessage, setCreateClubMessage] = useState('');
  const [joinClubMessage, setJoinClubMessage] = useState('');
  const [clubForm, setClubForm] = useState({ name: '', media_type: 'all', description: '' });

  const isAdmin = sessionStorage.getItem('is_admin') === 'true';

  const fetchClubs = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/media/clubs/', { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setClubs(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch {
      setClubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClubs(); }, []);

  const allClubs = useMemo(() => clubs, [clubs]);

  const handleJoinClub = async (clubId) => {
    setJoinClubMessage('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/media/clubs/${clubId}/join/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setJoinClubMessage('Successfully joined the club.');
        await fetchClubs();
      } else {
        setJoinClubMessage(data.error || data.detail || 'Failed to join club');
      }
    } catch {
      setJoinClubMessage('Failed to join club');
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    setCreateClubMessage('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/media/clubs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(clubForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowCreateClub(false);
        setClubForm({ name: '', media_type: 'all', description: '' });
        await fetchClubs();
      } else {
        setCreateClubMessage(data.error || data.detail || 'Failed to create club');
      }
    } catch {
      setCreateClubMessage('Failed to create club');
    }
  };

  const ClubGrid = ({ title, clubs: list, emptyText, actionForClub }) => (
    <div className="db-section">
      <div className="db-section-header">
        <span className="db-section-label">{title}</span>
      </div>
      <div className="db-clubs-grid">
        {loading ? (
          <p className="db-hint">Loading...</p>
        ) : list.length > 0 ? (
          list.map((club) => (
            <div key={club.id} className="db-club-card">
              <div className="db-club-card-image">
                {club.cover_image_url ? (
                  <img
                    src={club.cover_image_url}
                    alt=""
                    className="db-club-card-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : null}
              </div>
              <div className="db-club-card-info">
                <span className="db-club-name">{club.name}</span>
                {club.description ? <p className="db-club-desc">{club.description}</p> : null}
              </div>
              {actionForClub ? actionForClub(club) : null}
            </div>
          ))
        ) : (
          <p className="db-hint">{emptyText}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="db-root">
      <div className="clubs-hero">
        <div className="clubs-hero-row">
          <div className="clubs-hero-spacer" />
          <div className="clubs-hero-center">
            <h2 className="clubs-hero-title">
              {isAdmin ? 'Browse and manage clubs' : 'Join clubs and start discussions'}
            </h2>
          </div>
          <div className="clubs-hero-actions">
            {isAdmin ? (
              <button
                type="button"
                className="db-create-btn"
                onClick={() => { setCreateClubMessage(''); setShowCreateClub(true); }}
              >
                Create Clubs
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ClubGrid
        title="Clubs"
        clubs={allClubs}
        emptyText="No clubs yet."
        actionForClub={(club) => (
          <button
            type="button"
            className="db-join-btn db-club-card-btn"
            onClick={() => {
              if (isMemberClub(club)) onOpenClubDiscussion?.(club.id);
              else handleJoinClub(club.id);
            }}
          >
            {isMemberClub(club) ? 'Discuss' : 'Join'}
          </button>
        )}
      />

      {joinClubMessage ? <p className="inline-form-msg">{joinClubMessage}</p> : null}

      {showCreateClub && (
        <div className="db-modal-overlay" onClick={() => { setShowCreateClub(false); setCreateClubMessage(''); }}>
          <div className="db-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="db-modal-title">Create New Club</h3>
            <form className="db-modal-body" onSubmit={handleCreateClub}>
              <input
                className="db-input"
                type="text"
                placeholder="Club Name"
                value={clubForm.name}
                onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
              />
              <select
                className="db-input"
                value={clubForm.media_type}
                onChange={(e) => setClubForm({ ...clubForm, media_type: e.target.value })}
              >
                <option value="all">All Media</option>
                <option value="books">Books</option>
                <option value="movies">Movies</option>
                <option value="podcasts">Podcasts</option>
              </select>
              <textarea
                className="db-input"
                placeholder="Description (optional)"
                value={clubForm.description}
                onChange={(e) => setClubForm({ ...clubForm, description: e.target.value })}
                rows="3"
              />
              <div className="db-modal-actions">
                <button type="button" className="db-modal-cancel" onClick={() => { setShowCreateClub(false); setCreateClubMessage(''); }}>
                  Cancel
                </button>
                <button type="submit" className="db-modal-confirm">
                  Create Club
                </button>
              </div>
              {createClubMessage ? <p className="inline-form-msg">{createClubMessage}</p> : null}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

