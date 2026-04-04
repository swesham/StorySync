import { useState, useEffect } from 'react';
import './UserDashboard.css';
import '../inline-message.css';
import { DashboardChatNotifications, DashboardContinueChatting } from './DashboardChatBlocks';
import ShelfAnalyticsCharts from './ShelfAnalyticsCharts';

function UserDashboard({ onNavigate, onOpenClubDiscussion, onOpenProfile, onOpenChat }) {
  const [clubs, setClubs] = useState([]);
  const [shelfItems, setShelfItems] = useState([]);
  const [friends, setFriends] = useState([]);
  const [shelfStats, setShelfStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shelfPage, setShelfPage] = useState(0);
  const [clubPage, setClubPage] = useState(0);
  const [friendsPage, setFriendsPage] = useState(0);
  const [joinClubMessage, setJoinClubMessage] = useState('');

  const SHELF_PAGE_SIZE = 6;
  const CLUB_PAGE_SIZE = 4;
  const FRIENDS_PAGE_SIZE = 4;

  useEffect(() => {
    fetchClubs();
    fetchShelfItems();
    fetchFriends();
    fetchShelfStats();
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

  const handleJoinClub = async (clubId) => {
    setJoinClubMessage('');
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/media/clubs/${clubId}/join/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setJoinClubMessage('Successfully joined the club.');
        fetchClubs();
      } else {
        const error = await response.json();
        setJoinClubMessage(error.error || 'Failed to join club');
      }
    } catch (error) {
      setJoinClubMessage('Failed to join club');
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
            <button className="db-arrow-btn" onClick={() => setShelfPage(p => p - 1)}>‹</button>
          )}
        </div>
      </div>

      <div className="db-section">
        <div className="db-section-header">
          <span className="db-section-label">Clubs</span>
        </div>
        <div className="db-clubs-grid">
          {loading ? (
            <p className="db-hint">Loading...</p>
          ) : visibleClubs.length > 0 ? (
            visibleClubs.map((club) => {
              const isMember = club.current_user_role === 'ADMIN' || club.current_user_role === 'MEMBER';
              return (
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
                  {isMember ? (
                    <button type="button" className="db-join-btn db-club-card-btn" onClick={() => onOpenClubDiscussion?.(club.id)}>Discuss</button>
                  ) : (
                    <button type="button" className="db-join-btn db-club-card-btn" onClick={() => handleJoinClub(club.id)}>Join</button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="db-hint">No clubs yet.</p>
          )}
        </div>
        {(hasMoreClubs || clubPage > 0) && (
          <div className="db-next-row">
            {clubPage > 0 && <button type="button" className="db-pagination-btn" onClick={() => setClubPage(p => p - 1)}>Previous</button>}
            {hasMoreClubs && <button type="button" className="db-pagination-btn" onClick={() => setClubPage(p => p + 1)}>Next</button>}
          </div>
        )}
        {joinClubMessage ? <p className="inline-form-msg">{joinClubMessage}</p> : null}
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
                  {friendsPage > 0 && <button type="button" className="db-pagination-btn" onClick={() => setFriendsPage(p => p - 1)}>Previous</button>}
                  {hasMoreFriends && <button type="button" className="db-pagination-btn" onClick={() => setFriendsPage(p => p + 1)}>Next</button>}
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

    </div>
  );
}

export default UserDashboard;