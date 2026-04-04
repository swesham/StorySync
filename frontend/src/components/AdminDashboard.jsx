import { useState, useEffect } from 'react';
import './AdminDashboard.css';
import '../inline-message.css';
import { DashboardChatNotifications, DashboardContinueChatting } from './DashboardChatBlocks';
import ShelfAnalyticsCharts from './ShelfAnalyticsCharts';

function AdminDashboard({ onNavigate, onOpenClubDiscussion, onOpenProfile, onOpenChat }) {
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [shelfItems, setShelfItems] = useState([]);
  const [friends, setFriends] = useState([]);
  const [shelfStats, setShelfStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clubForm, setClubForm] = useState({ name: '', media_type: 'all', description: '' });
  const [showUsername, setShowUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [shelfPage, setShelfPage] = useState(0);
  const [clubPage, setClubPage] = useState(0);
  const [friendsPage, setFriendsPage] = useState(0);
  const [createClubMessage, setCreateClubMessage] = useState('');

  const SHELF_PAGE_SIZE = 6;
  const CLUB_PAGE_SIZE = 4;
  const FRIENDS_PAGE_SIZE = 4;

  useEffect(() => {
    fetchClubs();
    fetchShelfItems();
    fetchFriends();
    fetchShelfStats();
    setUsername(localStorage.getItem('username') || 'User');
  }, []);

  useEffect(() => {
    const onShelf = () => fetchShelfStats();
    window.addEventListener('shelfUpdated', onShelf);
    return () => window.removeEventListener('shelfUpdated', onShelf);
  }, []);

  const fetchShelfStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/media/shelf-stats/', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setShelfStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch shelf stats:', err);
    }
  };

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/profile/me/friends/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    }
  };

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
    setCreateClubMessage('');
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
        setCreateClubMessage(error.error || 'Failed to create club');
      }
    } catch (error) {
      setCreateClubMessage('Failed to create club');
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

  const visibleFriends = friends.slice(friendsPage * FRIENDS_PAGE_SIZE, (friendsPage + 1) * FRIENDS_PAGE_SIZE);
  const hasMoreFriends = (friendsPage + 1) * FRIENDS_PAGE_SIZE < friends.length;

  return (
    <div className="db-root">
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

      <div className="db-section">
        <div className="db-section-header">
          <span className="db-section-label">Clubs</span>
          <button className="db-create-btn" onClick={() => { setCreateClubMessage(''); setShowCreateClub(true); }}>Create Clubs</button>
        </div>
        <div className="db-clubs-grid">
          {loading ? (
            <p className="db-hint">Loading...</p>
          ) : visibleClubs.length > 0 ? (
            visibleClubs.map((club) => (
              <div key={club.id} className="db-club-card">
                <div className="db-club-card-image">
                  {club.cover_image_url ? (
                    <img src={club.cover_image_url} alt="" className="db-club-card-img" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : null}
                </div>
                <div className="db-club-card-info">
                  <span className="db-club-name">{club.name}</span>
                  {club.description ? <p className="db-club-desc">{club.description}</p> : null}
                </div>
                <button type="button" className="db-join-btn db-club-card-btn" onClick={() => onOpenClubDiscussion?.(club.id)}>Discuss</button>
              </div>
            ))
          ) : (
            [0, 1, 2, 3].map(i => <div key={i} className="db-club-card db-club-card-placeholder" />)
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

      <DashboardChatNotifications onOpenProfile={onOpenProfile} />

      <div className="db-section">
        <span className="db-section-label">Friends</span>
        <div className="db-friends-area">
          {visibleFriends.length === 0 ? (
            <p className="db-hint">No friends yet.</p>
          ) : (
            <>
              <ul className="db-friends-list">
                {visibleFriends.map((f) => (
                  <li key={f.id} className="db-friends-item">
                    <span className="db-friends-name" onClick={() => onOpenProfile?.(f.id)}>{f.display_name || f.username}</span>
                    {onOpenChat && <button type="button" className="db-friends-msg-btn" onClick={() => onOpenChat(f.id, f.display_name || f.username)}>Message</button>}
                  </li>
                ))}
              </ul>
              {(hasMoreFriends || friendsPage > 0) && (
                <div className="db-next-row">
                  {friendsPage > 0 && <span className="db-next-link" onClick={() => setFriendsPage(p => p - 1)}>‹ Prev</span>}
                  {hasMoreFriends && <span className="db-next-link" onClick={() => setFriendsPage(p => p + 1)}>Next ›</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <DashboardContinueChatting onOpenProfile={onOpenProfile} onOpenChat={onOpenChat} />

      {shelfStats && (
        <div className="db-section">
          <span className="db-section-label">Shelf analytics</span>
          <p className="db-hint">Stats from your shelf</p>
          <ShelfAnalyticsCharts shelfStats={shelfStats} />
        </div>
      )}

      {showCreateClub && (
        <div className="db-modal-overlay" onClick={() => { setShowCreateClub(false); setCreateClubMessage(''); }}>
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
                <button className="db-modal-cancel" onClick={() => { setShowCreateClub(false); setCreateClubMessage(''); }}>Cancel</button>
                <button className="db-modal-confirm" onClick={handleCreateClub}>Create Club</button>
              </div>
              {createClubMessage ? <p className="inline-form-msg">{createClubMessage}</p> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;