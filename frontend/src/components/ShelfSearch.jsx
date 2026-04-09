import { useState } from 'react';
import './ShelfSearch.css';
import '../inline-message.css';
import MediaDetail from './MediaDetail';

const API_BASE_URL = '/api/media';

export default function ShelfSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState([]);
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchMessage('Please enter a search title.');
      return;
    }
    setSearchMessage('');
    setLoading(true);
    setHints([]);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, type: mediaType });
      if (genre) params.append('genre', genre);
      if (year) params.append('year', year);
      const response = await fetch(`${API_BASE_URL}/search/?${params}`);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : { results: [], error: 'Invalid response from server' };
      setResults(data.results || []);
      const nextHints = [...(data.hints || [])];
      if (data.hint && !nextHints.includes(data.hint)) nextHints.push(data.hint);
      setHints(nextHints);
      if (!response.ok && data.error) {
        setSearchMessage(String(data.error));
      }
    } catch (error) {
      setSearchMessage(error.message || 'Search failed. Check that the backend is running.');
      setResults([]);
      setHints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setMediaType('all');
    setGenre('');
    setYear('');
    setResults([]);
    setHints([]);
    setLoading(false);
    setSelectedItem(null);
    setSearchMessage('');
    setHasSearched(false);
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter') handleSearch(); };
  const handleItemClick = (item) => setSelectedItem(item);
  const handleCloseDetail = () => setSelectedItem(null);

  const getThumbnail = (item) => {
    if (item.type === 'book') return item.data?.volumeInfo?.imageLinks?.thumbnail || item.data?.volumeInfo?.imageLinks?.smallThumbnail || 'https://via.placeholder.com/150x200?text=No+Image';
    if (item.type === 'movie') { const p = item.data?.poster_path; return p ? `https://image.tmdb.org/t/p/w200${p}` : 'https://via.placeholder.com/150x200?text=No+Image'; }
    if (item.type === 'podcast') return item.data?.image || item.data?.thumbnail || 'https://via.placeholder.com/150x200?text=No+Image';
    return 'https://via.placeholder.com/150x200?text=No+Image';
  };

  const getTitle = (item) => {
    if (item.type === 'book') return item.data?.volumeInfo?.title || 'Unknown Title';
    if (item.type === 'movie') return item.data?.title || 'Unknown Title';
    if (item.type === 'podcast') return item.data?.title_original || item.data?.title || 'Unknown Title';
    return 'Unknown Title';
  };

  return (
    <div className="ss-container">
      <div className="ss-topbar">
        <div className="ss-bar">
          <input
            type="text"
            className="ss-input"
            placeholder="Search books, movies, podcasts..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchMessage(''); }}
            onKeyPress={handleKeyPress}
          />
          <button type="button" className="ss-btn" onClick={handleSearch}>Search</button>
          <button type="button" className="ss-btn" onClick={handleClearAll}>Clear all</button>
        </div>
      </div>

      {searchMessage ? <p className="inline-form-msg ss-inline-msg">{searchMessage}</p> : null}

      <div className="ss-filter">
        <div className="ss-filter-buttons">
          {['all', 'book', 'movie', 'podcast'].map((type) => (
            <button
              key={type}
              type="button"
              className={`ss-filter-btn ${mediaType === type ? 'active' : ''}`}
              onClick={() => setMediaType(type)}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
            </button>
          ))}
        </div>
        <div className="ss-filter-inputs">
          <input className="ss-filter-input" type="text" placeholder="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
          <input className="ss-filter-input" type="text" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
          <button type="button" className="ss-show-btn" onClick={handleSearch}>Filter</button>
        </div>
      </div>

      {(hasSearched || loading) ? (
        <div className="ss-results">
          {hints.length > 0 && (
            <div className="ss-hints" role="status">
              {hints.map((h, i) => (
                <p key={i} className="ss-hint-line">{h}</p>
              ))}
            </div>
          )}
          {loading ? (
            <div className="ss-loading">Searching...</div>
          ) : results.length === 0 ? (
            <div className="ss-empty">
              {searchQuery ? 'No results found.' : 'Enter a search'}
            </div>
          ) : (
            <div className="ss-grid">
              {results.map((item, index) => (
                <div key={index} className="ss-item" onClick={() => handleItemClick(item)}>
                  <img
                    src={getThumbnail(item)}
                    alt={getTitle(item)}
                    className="ss-thumb"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150x200?text=No+Image'; }}
                  />
                  <p className="ss-title">{getTitle(item)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {selectedItem && <MediaDetail item={selectedItem} onClose={handleCloseDetail} />}
    </div>
  );
}

