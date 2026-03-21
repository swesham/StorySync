import { useState } from 'react';
import './SearchFilter.css';
import MediaDetail from './MediaDetail';

function SearchFilter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const API_BASE_URL = '/api/media';

  const handleSearch = async () => {
    if (!searchQuery.trim()) { alert('Please enter a search title'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, type: mediaType });
      if (genre) params.append('genre', genre);
      if (year) params.append('year', year);
      const response = await fetch(`${API_BASE_URL}/search/?${params}`);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : { results: [], error: 'Invalid response from server' };
      setResults(data.results || []);
      if (!response.ok && data.error) {
        alert(data.error);
      }
    } catch (error) {
      alert(error.message || 'Failed to search. Check that the backend is running (python manage.py runserver).');
      setResults([]);
    } finally {
      setLoading(false);
    }
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
    <div className="search-filter-container">

      <div className="search-topbar">
        <div className="search-bar-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search books, movies, podcasts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="search-icon-btn" onClick={handleSearch}>Search</button>
        </div>
      </div>

      <div className="filter-section">
        <div className="filter-buttons">
          {['all', 'book', 'movie', 'podcast'].map(type => (
            <button
              key={type}
              className={`filter-btn ${mediaType === type ? 'active' : ''}`}
              onClick={() => setMediaType(type)}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
            </button>
          ))}
        </div>
        <div className="filter-inputs">
          <input className="filter-input" type="text" placeholder="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
          <input className="filter-input" type="text" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <button className="show-result-btn" onClick={handleSearch}>Show results</button>
      </div>

      <div className="results-section">
        {loading ? (
          <div className="loading-message">Searching...</div>
        ) : results.length === 0 ? (
          <div className="empty-message">
            {searchQuery ? 'No results found.' : 'Enter a search'}
          </div>
        ) : (
          <div className="results-grid">
            {results.map((item, index) => (
              <div key={index} className="result-item" onClick={() => handleItemClick(item)}>
                <img
                  src={getThumbnail(item)}
                  alt={getTitle(item)}
                  className="result-thumbnail"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150x200?text=No+Image'; }}
                />
                <p className="result-title">{getTitle(item)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && <MediaDetail item={selectedItem} onClose={handleCloseDetail} />}
    </div>
  );
}

export default SearchFilter;