import { useState, useEffect } from 'react';
import './AdminDashboard.css';

function AdminDashboard({ onNavigate, onOpenClubDiscussion }) {
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [shelfItems, setShelfItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubForm, setClubForm] = useState({ name: '', media_type: 'all', description: '' });
  const [showUsername, setShowUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [shelfPage, setShelfPage] = useState(0);
  const [clubPage, setClubPage] = useState(0);

  const SHELF_PAGE_SIZE = 6;
  const CLUB_PAGE_SIZE = 4;

  useEffect(() => {
    fetchClubs();
    fetchShelfItems();
    setUsername(localStorage.getItem('username') || 'User');
  }, []);

  const fetchClubs = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/media/clubs/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClubs(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
    } catch (error) {
      console.error('Failed to fetch clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShelfItems = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const [booksRes, moviesRes, podcastsRes] = await Promise.all([
        fetch('/api/media/shelf/books/', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/media/shelf/movies/', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/media/shelf/podcasts/', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [books, movies, podcasts] = await Promise.all([
        booksRes.ok ? booksRes.json() : [],
        moviesRes.ok ? moviesRes.json() : [],
        podcastsRes.ok ? podcastsRes.json() : []
      ]);
      setShelfItems([
        ...books.filter(i => i.status === 'IN_PROGRESS'),
        ...movies.filter(i => i.status === 'IN_PROGRESS'),
        ...podcasts.filter(i => i.status === 'IN_PROGRESS'),
      ]);
    } catch (error) {
      console.error('Failed to fetch shelf items:', error);
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/media/clubs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(clubForm),
      });
      if (response.ok) {
        setShowCreateClub(false);
        setClubForm({ name: '', media_type: 'all', description: '' });
        fetchClubs();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create club');
      }
    } catch (error) {
      alert('Failed to create club');
    }
  };

  const getThumbnail = (item) => {
    if (item.thumbnail) return item.thumbnail;
    if (item.poster_url) return item.poster_url;
    if (item.image) return item.image;
    return null;
  };

  const visibleShelf = shelfItems.slice(shelfPage * SHELF_PAGE_SIZE, (shelfPage + 1) * SHELF_PAGE_SIZE);
  const hasMoreShelf = (shelfPage + 1) * SHELF_PAGE_SIZE < shelfItems.length;

  const visibleClubs = clubs.slice(clubPage * CLUB_PAGE_SIZE, (clubPage + 1) * CLUB_PAGE_SIZE);
  const hasMoreClubs = (clubPage + 1) * CLUB_PAGE_SIZE < clubs.length;

  return (
    <div className="db-root">
      {/* Continue Story */}
      <div className="db-section">
        <span className="db-section-label">Continue the story</span>
        <div className="db-card-area">
          <div className="db-cards-row">
            {(visibleShelf.length > 0 ? visibleShelf : [0, 1, 2, 3]).map((item, i) => (
              <div key={i} className="db-media-card">
                {item.title && getThumbnail(item) && (
                  <img
                    src={getThumbnail(item)}
                    alt={item.title}
                    className="db-media-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            ))}
          </div>
          {hasMoreShelf && (
            <button className="db-arrow-btn" onClick={() => setShelfPage(p => p + 1)}>›</button>
          )}
          {shelfPage > 0 && (
            <button className="db-arrow-btn left" onClick={() => setShelfPage(p => p - 1)}>‹</button>
          )}
        </div>
      </div>

      {/* Clubs */}
      <div className="db-section">
        <div className="db-section-header">
          <span className="db-section-label">Clubs</span>
          <button className="db-create-btn" onClick={() => setShowCreateClub(true)}>Create Clubs</button>
        </div>
        <div className="db-clubs-list">
          {loading ? (
            <p className="db-hint">Loading...</p>
          ) : visibleClubs.length > 0 ? (
            visibleClubs.map((club) => (
              <div key={club.id} className="db-club-row">
                <div className="db-club-info">
                  <span
                    className="db-club-name"
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => onOpenClubDiscussion?.(club.id)}
                  >
                    {club.name}
                  </span>
                  {club.description && <p className="db-club-desc">{club.description}</p>}
                </div>
                <button type="button" className="db-join-btn" onClick={() => onOpenClubDiscussion?.(club.id)}>Discussion</button>
              </div>
            ))
          ) : (
            [0, 1, 2, 3].map(i => <div key={i} className="db-club-row db-placeholder-row" />)
          )}
        </div>
        {(hasMoreClubs || clubPage > 0) && (
          <div className="db-next-row">
            {clubPage > 0 && (
              <span className="db-next-link" onClick={() => setClubPage(p => p - 1)}>‹ Prev</span>
            )}
            {hasMoreClubs && (
              <span className="db-next-link" onClick={() => setClubPage(p => p + 1)}>Next ›</span>
            )}
          </div>
        )}
      </div>

      {/* Friends */}
      <div className="db-section">
        <span className="db-section-label">Friends</span>
        <div className="db-friends-area" />
      </div>

      {/* Modal */}
      {showCreateClub && (
        <div className="db-modal-overlay" onClick={() => setShowCreateClub(false)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h3 className="db-modal-title">Create New Club</h3>
            <div className="db-modal-body">
              <input className="db-input" type="text" placeholder="Club Name"
                value={clubForm.name} onChange={e => setClubForm({ ...clubForm, name: e.target.value })} />
              <select className="db-input" value={clubForm.media_type}
                onChange={e => setClubForm({ ...clubForm, media_type: e.target.value })}>
                <option value="all">All Media</option>
                <option value="books">Books</option>
                <option value="movies">Movies</option>
                <option value="podcasts">Podcasts</option>
              </select>
              <textarea className="db-input" placeholder="Description (optional)"
                value={clubForm.description}
                onChange={e => setClubForm({ ...clubForm, description: e.target.value })} rows="3" />
              <div className="db-modal-actions">
                <button className="db-modal-cancel" onClick={() => setShowCreateClub(false)}>Cancel</button>
                <button className="db-modal-confirm" onClick={handleCreateClub}>Create Club</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;