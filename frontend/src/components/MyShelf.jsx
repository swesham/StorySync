import { useState, useEffect } from 'react';
import './MyShelf.css';

function MyShelf({ onNavigate }) {
  const [selectedMediaType, setSelectedMediaType] = useState('Books');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [shelfItems, setShelfItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('Username');
  const [currentItem, setCurrentItem] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showUsername, setShowUsername] = useState(false);

  const API_BASE_URL = '/api/media';

  const refreshShelf = () => setRefreshTrigger(prev => prev + 1);

  const getStatusLabels = () => {
    if (selectedMediaType === 'Books') return {
      tabs: ['Want to Read', 'In Progress', 'Finished'],
      statusMap: { 'Want to Read': 'WANT_TO_READ', 'In Progress': 'IN_PROGRESS', 'Finished': 'FINISHED' },
      currentLabel: 'Currently Reading', typeLabel: 'Book',
    };
    if (selectedMediaType === 'Movies') return {
      tabs: ['Want to Watch', 'In Progress', 'Finished'],
      statusMap: { 'Want to Watch': 'WANT_TO_WATCH', 'In Progress': 'IN_PROGRESS', 'Finished': 'FINISHED' },
      currentLabel: 'Currently Watching', typeLabel: 'Movie',
    };
    return {
      tabs: ['Want to Listen', 'In Progress', 'Finished'],
      statusMap: { 'Want to Listen': 'WANT_TO_LISTEN', 'In Progress': 'IN_PROGRESS', 'Finished': 'FINISHED' },
      currentLabel: 'Currently Listening', typeLabel: 'Podcast',
    };
  };

  const statusConfig = getStatusLabels();

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      try {
        const response = await fetch('/api/profile/me/', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUsername(data.username || 'Username');
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };
    fetchUserProfile();
  }, []);

  useEffect(() => {
    const fetchShelfItems = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) { setShelfItems([]); setCurrentItem(null); return; }
      setLoading(true);
      try {
        let endpoint = selectedMediaType === 'Books'
          ? `${API_BASE_URL}/shelf/books/`
          : selectedMediaType === 'Movies'
          ? `${API_BASE_URL}/shelf/movies/`
          : `${API_BASE_URL}/shelf/podcasts/`;

        const url = selectedStatus && statusConfig.statusMap[selectedStatus]
          ? `${endpoint}?status=${statusConfig.statusMap[selectedStatus]}`
          : endpoint;

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
          setShelfItems(items);
          const inProgress = items.find(i => i.status === 'IN_PROGRESS');
          setCurrentItem(inProgress || items[0] || null);
        } else {
          setShelfItems([]); setCurrentItem(null);
        }
      } catch (error) {
        setShelfItems([]); setCurrentItem(null);
      } finally {
        setLoading(false);
      }
    };
    fetchShelfItems();
  }, [selectedMediaType, selectedStatus, refreshTrigger]);

  useEffect(() => {
    const onShelfUpdate = () => refreshShelf();
    window.addEventListener('storage', onShelfUpdate);
    window.addEventListener('shelfUpdated', onShelfUpdate);
    return () => {
      window.removeEventListener('storage', onShelfUpdate);
      window.removeEventListener('shelfUpdated', onShelfUpdate);
    };
  }, []);
  useEffect(() => { refreshShelf(); }, []);
  useEffect(() => { setSelectedStatus(''); }, [selectedMediaType]);

  const getThumbnail = (item) => {
    if (selectedMediaType === 'Books') return item.thumbnail || 'https://via.placeholder.com/150x200?text=No+Image';
    if (selectedMediaType === 'Movies') return item.poster_url || 'https://via.placeholder.com/150x200?text=No+Image';
    return item.image || 'https://via.placeholder.com/150x200?text=No+Image';
  };

  const getTitle = (item) => item.title || 'Unknown Title';

  const getShelfEndpoint = (mediaType) => {
    if (mediaType === 'Books') return `${API_BASE_URL}/shelf/books/`;
    if (mediaType === 'Movies') return `${API_BASE_URL}/shelf/movies/`;
    return `${API_BASE_URL}/shelf/podcasts/`;
  };

  const handleStatusChange = async (item, newStatus) => {
    const token = localStorage.getItem('access_token');
    if (!token || !item?.id) return;
    const base = getShelfEndpoint(selectedMediaType);
    try {
      const response = await fetch(`${base}${item.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        refreshShelf();
      }
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  return (
    <div className="ms-root">
      {/* Body */}
      <div className="ms-body">

        {/* Left Sidebar */}
        <div className="ms-sidebar-left">
          <div className="ms-user-label">{username}</div>
          <div className="ms-media-nav">
            {['Movies', 'Podcasts', 'Books'].map(type => (
              <button
                key={type}
                className={`ms-media-btn ${selectedMediaType === type ? 'active' : ''}`}
                onClick={() => setSelectedMediaType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="ms-main">
          <div className="ms-status-tabs">
            {statusConfig.tabs.map(tab => (
              <button
                key={tab}
                className={`ms-tab ${selectedStatus === tab ? 'active' : ''}`}
                onClick={() => setSelectedStatus(tab)}
              >
                {tab}
              </button>
            ))}
            <button
            className={`ms-tab ${selectedStatus === 'Pending' ? 'active' : ''}`}
            onClick={() => setSelectedStatus('Pending')}
          >
            Pending
          </button>
          </div>
          

          <div className="ms-grid-area">
            {loading ? (
              <p className="ms-empty">Loading...</p>
            ) : shelfItems.length === 0 ? (
              <p className="ms-empty">No {selectedMediaType.toLowerCase()} in {selectedStatus || 'your shelf'}</p>
            ) : (
              <div className="ms-grid">
                {shelfItems.map(item => (
                  <div key={item.id} className="ms-card" onClick={() => setCurrentItem(item)}>
                    <img
                      src={getThumbnail(item)}
                      alt={getTitle(item)}
                      className="ms-card-img"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/150x200?text=No+Image'; }}
                    />
                    <p className="ms-card-title">{getTitle(item)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="ms-sidebar-right">
          <div className="ms-sync-label">SYNC</div>

          <div className="ms-current-card">
            <h3 className="ms-current-title">{statusConfig.currentLabel}</h3>
            <p className="ms-current-type">{statusConfig.typeLabel}</p>
            <div className="ms-current-img-box">
              {currentItem ? (
                <img
                  src={getThumbnail(currentItem)}
                  alt={getTitle(currentItem)}
                  className="ms-current-img"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/200x300?text=No+Image'; }}
                />
              ) : (
                <p className="ms-empty">No active item</p>
              )}
            </div>
          </div>

          {currentItem && (
            <div className="ms-metadata">
              <p className="ms-meta-title">{getTitle(currentItem)}</p>
              <select
                className="ms-status-select"
                value={currentItem.status}
                onChange={(e) => handleStatusChange(currentItem, e.target.value)}
              >
                {Object.entries(statusConfig.statusMap).map(([label, value]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyShelf;