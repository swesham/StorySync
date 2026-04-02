import { useState, useEffect, useMemo } from 'react';
import './MyShelf.css';
import './ClubShelf.css';

const API = '/api/media';

function ClubShelf({ onNavigate, initialClubId = null }) {
  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [allShelfItems, setAllShelfItems] = useState([]);
  const [selectedMediaType, setSelectedMediaType] = useState('Books');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const token = () => localStorage.getItem('access_token');
  const auth = () => ({ Authorization: `Bearer ${token()}` });
  const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

  const refreshShelf = () => setRefreshTrigger((p) => p + 1);

  const statusConfig = useMemo(() => {
    if (selectedMediaType === 'Books') {
      return {
        tabs: ['Want to Read', 'In Progress', 'Finished'],
        statusMap: { 'Want to Read': 'WANT', 'In Progress': 'IN_PROGRESS', 'Finished': 'FINISHED' },
        currentLabel: 'Currently Reading', typeLabel: 'Book',
      };
    }
    if (selectedMediaType === 'Movies') {
      return {
        tabs: ['Want to Watch', 'In Progress', 'Finished'],
        statusMap: { 'Want to Watch': 'WANT', 'In Progress': 'IN_PROGRESS', 'Finished': 'FINISHED' },
        currentLabel: 'Currently Watching', typeLabel: 'Movie',
      };
    }
    return {
      tabs: ['Want to Listen', 'In Progress', 'Finished'],
      statusMap: { 'Want to Listen': 'WANT', 'In Progress': 'IN_PROGRESS', 'Finished': 'FINISHED' },
      currentLabel: 'Currently Listening', typeLabel: 'Podcast',
    };
  }, [selectedMediaType]);

  useEffect(() => {
    const t = token();
    if (!t) {
      setClubs([]);
      setSelectedClubId(null);
      return;
    }
    fetch(`${API}/clubs/`, { headers: auth() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setClubs(list);
        setSelectedClubId((prev) => {
          if (initialClubId != null && list.some((c) => c.id === initialClubId)) {
            return initialClubId;
          }
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch(() => setClubs([]));
  }, [initialClubId]);

  useEffect(() => {
    const t = token();
    if (!t || !selectedClubId) {
      setAllShelfItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API}/clubs/${selectedClubId}/shelf/`, { headers: auth() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setAllShelfItems(Array.isArray(data) ? data : []);
      })
      .catch(() => setAllShelfItems([]))
      .finally(() => setLoading(false));
  }, [selectedClubId, refreshTrigger]);

  useEffect(() => {
    setSelectedStatus('');
  }, [selectedMediaType]);

  useEffect(() => {
    const onShelfUpdate = () => refreshShelf();
    window.addEventListener('shelfUpdated', onShelfUpdate);
    return () => window.removeEventListener('shelfUpdated', onShelfUpdate);
  }, []);

  const selectedClub = clubs.find((c) => c.id === selectedClubId) || null;
  const canEditShelf = selectedClub?.current_user_role === 'ADMIN';

  const shelfItems = useMemo(() => {
    return allShelfItems.filter((i) => {
      const typeMatch =
        (selectedMediaType === 'Books' && i.media_type === 'BOOK') ||
        (selectedMediaType === 'Movies' && i.media_type === 'MOVIE') ||
        (selectedMediaType === 'Podcasts' && i.media_type === 'PODCAST');
      if (!typeMatch) return false;
      if (!selectedStatus || !statusConfig.statusMap[selectedStatus]) return true;
      return i.status === statusConfig.statusMap[selectedStatus];
    });
  }, [allShelfItems, selectedMediaType, selectedStatus, statusConfig]);

  useEffect(() => {
    setCurrentItem((prev) => {
      if (prev && shelfItems.some((i) => i.id === prev.id)) return prev;
      return shelfItems.find((i) => i.status === 'IN_PROGRESS') || shelfItems[0] || null;
    });
  }, [shelfItems]);

  const getThumbnail = (item) => item?.image_url || 'https://via.placeholder.com/150x200?text=No+Image';
  const getTitle = (item) => item?.title || 'Unknown Title';

  const handleStatusChange = async (item, newStatus) => {
    if (!token() || !item?.id || !selectedClubId || !canEditShelf) return;
    try {
      const res = await fetch(`${API}/clubs/${selectedClubId}/shelf/${item.id}/`, {
        method: 'PATCH',
        headers: json(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) refreshShelf();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="ms-root">
      <div className="ms-body">
        <div className="ms-sidebar-left">
          
          <div className="ms-user-label ms-club-shelf-brand">Club Shelf</div>
          {clubs.length === 0 ? (
            <p className="ms-club-empty-hint">No clubs yet.</p>
          ) : (
            <label className="ms-club-select-label">
              Club
              <select
                className="ms-club-select"
                value={selectedClubId ?? ''}
                onChange={(e) => setSelectedClubId(Number(e.target.value))}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="ms-media-nav">
            {['Movies', 'Podcasts', 'Books'].map((type) => (
              <button
                key={type}
                type="button"
                className={`ms-media-btn ${selectedMediaType === type ? 'active' : ''}`}
                onClick={() => setSelectedMediaType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="ms-main">
          <div className="ms-status-tabs">
            {statusConfig.tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`ms-tab ${selectedStatus === tab ? 'active' : ''}`}
                onClick={() => setSelectedStatus(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="ms-grid-area">
            {!selectedClubId ? (
              <p className="ms-empty">Select a club.</p>
            ) : loading ? (
              <p className="ms-empty">Loading...</p>
            ) : shelfItems.length === 0 ? (
              <p className="ms-empty">No items.</p>
            ) : (
              <div className="ms-grid">
                {shelfItems.map((item) => (
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
              <p className="ms-meta-genre">Genre: —</p>
              {canEditShelf ? (
                <select
                  className="ms-status-select"
                  value={currentItem.status}
                  onChange={(e) => handleStatusChange(currentItem, e.target.value)}
                >
                  {Object.entries(statusConfig.statusMap).map(([label, value]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : (
                <p className="ms-club-readonly-status">Status: {Object.entries(statusConfig.statusMap).find(([, v]) => v === currentItem.status)?.[0] || currentItem.status}</p>
              )}
              {selectedMediaType === 'Books' && currentItem.media_type === 'BOOK' && currentItem.media_id && (
                <a
                  href={`https://www.amazon.com/s?k=${encodeURIComponent(currentItem.media_id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-buy-amazon"
                >
                  Search on Amazon
                </a>
              )}
              <div className="ms-review-block ms-club-shelf-block">
                <span className="ms-review-label">Club shelf</span>
                <p className="ms-club-shelf-name">{selectedClub?.name || '—'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClubShelf;
