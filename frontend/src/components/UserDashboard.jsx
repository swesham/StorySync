import { useState, useEffect } from 'react';
import './UserDashboard.css';

function UserDashboard({ onNavigate, onOpenClubDiscussion }) {
  const [clubs, setClubs] = useState([]);
  const [shelfItems, setShelfItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shelfPage, setShelfPage] = useState(0);
  const [clubPage, setClubPage] = useState(0);

  const SHELF_PAGE_SIZE = 6;
  const CLUB_PAGE_SIZE = 4;

  useEffect(() => {
    fetchClubs();
    fetchShelfItems();
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

  const handleJoinClub = async (clubId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/media/clubs/${clubId}/join/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        alert('Successfully joined the club!');
        fetchClubs();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to join club');
      }
    } catch (error) {
      alert('Failed to join club');
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
            <button className="db-arrow-btn" onClick={() => setShelfPage(p => p - 1)}>‹</button>
          )}
        </div>
      </div>

      {/* Clubs */}
      <div className="db-section">
        <div className="db-section-header">
          <span className="db-section-label">Clubs</span>
        </div>
        <div className="db-clubs-list">
          {loading ? (
            <p className="db-hint">Loading...</p>
          ) : visibleClubs.length > 0 ? (
            visibleClubs.map((club) => {
              const isMember = club.current_user_role === 'ADMIN' || club.current_user_role === 'MEMBER';
              return (
                <div key={club.id} className="db-club-row">
                  <div className="db-club-info">
                    <span
                      className="db-club-name"
                      style={isMember ? { cursor: 'pointer', textDecoration: 'underline' } : {}}
                      onClick={isMember ? () => onOpenClubDiscussion?.(club.id) : undefined}
                    >
                      {club.name}
                    </span>
                    {club.description && <p className="db-club-desc">{club.description}</p>}
                  </div>
                  {isMember ? (
                    <button type="button" className="db-join-btn" onClick={() => onOpenClubDiscussion?.(club.id)}>Discussion</button>
                  ) : (
                    <button className="db-join-btn" onClick={() => handleJoinClub(club.id)}>Join</button>
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
      </div>

      {/* Friends */}
      <div className="db-section">
        <span className="db-section-label">Friends</span>
        <div className="db-friends-area" />
      </div>

    </div>
  );
}

export default UserDashboard;