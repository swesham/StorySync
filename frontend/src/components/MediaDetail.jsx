import { useState, useEffect } from 'react';
import './MediaDetail.css';
import '../inline-message.css';

function MediaDetail({ item, onClose }) {
  const getDefaultStatus = () => {
    if (item?.type === 'book') return 'WANT_TO_READ';
    if (item?.type === 'movie') return 'WANT_TO_WATCH';
    if (item?.type === 'podcast') return 'WANT_TO_LISTEN';
    return 'WANT_TO_READ';
  };

  const [shelfStatus, setShelfStatus] = useState(getDefaultStatus());

  useEffect(() => {
    setShelfStatus(getDefaultStatus());
  }, [item?.type]);
  const [addingToShelf, setAddingToShelf] = useState(false);
  const [addingToClubShelf, setAddingToClubShelf] = useState(false);
  const [adminClubs, setAdminClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const API_BASE_URL = '/api/media';

  useEffect(() => {
    setActionMessage('');
  }, [item]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !item) {
      setAdminClubs([]);
      setSelectedClubId('');
      return;
    }
    fetch(`${API_BASE_URL}/clubs/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const admins = list.filter((c) => c.current_user_role === 'ADMIN');
        setAdminClubs(admins);
        setSelectedClubId((prev) => {
          const n = typeof prev === 'number' ? prev : Number(prev);
          if (n && admins.some((c) => c.id === n)) return n;
          return admins[0]?.id ?? '';
        });
      })
      .catch(() => {
        setAdminClubs([]);
        setSelectedClubId('');
      });
  }, [item]);

  const getDetails = () => {
    if (item.type === 'book') {
      const info = item.data?.volumeInfo || {};
      const identifiers = info.industryIdentifiers || [];
      const isbnObj = identifiers.find((i) => i.type === 'ISBN_13') || identifiers.find((i) => i.type === 'ISBN_10');
      const isbn = isbnObj ? (isbnObj.identifier || '').trim() : '';
      return {
        title: info.title || 'Unknown Title',
        authors: info.authors?.join(', ') || 'Unknown Author',
        description: info.description || 'No description available',
        thumbnail: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '',
        publishedDate: info.publishedDate || '',
        categories: info.categories || [],
        pageCount: info.pageCount || 0,
        mediaId: item.data?.id || '',
        isbn: isbn,
      };
    } else if (item.type === 'movie') {
      const movieData = item.data || {};
      const movieId = movieData.id ? String(movieData.id).trim() : '';
      
      if (!movieId) {
        console.warn('Movie ID missing. Available fields:', Object.keys(movieData));
        console.warn('Full movie data:', movieData);
      }
      
      const posterRaw = movieData.poster_url || movieData.poster_path;
      const thumbMovie = posterRaw
        ? (String(posterRaw).startsWith('http') ? posterRaw : `https://image.tmdb.org/t/p/w500${posterRaw}`)
        : '';
      return {
        title: movieData.title || 'Unknown Title',
        authors: movieData.release_date?.substring(0, 4) || 'Unknown Year',
        description: movieData.overview || 'No description available',
        thumbnail: thumbMovie,
        publishedDate: movieData.release_date || '',
        categories: movieData.genre_ids || [],
        pageCount: movieData.vote_average || 0,
        mediaId: movieId,
      };
    } else if (item.type === 'podcast') {
      const podcastData = item.data || {};
      const podcastId = podcastData.id 
        ? String(podcastData.id).trim()
        : '';
      
      if (!podcastId) {
        console.warn('Podcast ID missing. Available fields:', Object.keys(podcastData));
        console.warn('Full podcast data:', podcastData);
      }
      
      return {
        title: podcastData.title_original || podcastData.title || 'Unknown Title',
        authors: podcastData.publisher_original || podcastData.publisher || 'Unknown Publisher',
        description: podcastData.description_original || podcastData.description || 'No description available',
        thumbnail: podcastData.image || podcastData.thumbnail || '',
        publishedDate: podcastData.earliest_pub_date_ms 
          ? new Date(podcastData.earliest_pub_date_ms).getFullYear().toString()
          : '',
        categories: podcastData.genre_ids || [],
        pageCount: podcastData.total_episodes || 0,
        mediaId: podcastId,
      };
    }
    return {};
  };

  const details = getDetails();

  const mapShelfStatusToClub = (s) => {
    if (['WANT_TO_READ', 'WANT_TO_WATCH', 'WANT_TO_LISTEN'].includes(s)) return 'WANT';
    if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
    if (s === 'FINISHED') return 'FINISHED';
    return 'WANT';
  };

  const prepareClubShelfPayload = () => {
    const mt = item.type === 'book' ? 'BOOK' : item.type === 'movie' ? 'MOVIE' : 'PODCAST';
    return {
      media_type: mt,
      media_id: String(details.mediaId || '').trim(),
      title: details.title || '',
      image_url: details.thumbnail || '',
      status: mapShelfStatusToClub(shelfStatus),
    };
  };

  const getShelfEndpoint = () => {
    if (item.type === 'book') return `${API_BASE_URL}/shelf/books/`;
    if (item.type === 'movie') return `${API_BASE_URL}/shelf/movies/`;
    if (item.type === 'podcast') return `${API_BASE_URL}/shelf/podcasts/`;
    return '';
  };

  const prepareShelfData = () => {
    if (item.type === 'book') {
      return {
        google_books_id: details.mediaId,
        title: details.title,
        authors: details.authors,
        thumbnail: details.thumbnail,
        isbn: details.isbn || '',
        genres: Array.isArray(details.categories) ? details.categories : [],
        status: shelfStatus,
        progress: 0,
      };
    } else if (item.type === 'movie') {
      const releaseYear = details.publishedDate && details.publishedDate.length >= 4
        ? parseInt(details.publishedDate.substring(0, 4))
        : null;
      
      const genreIds = Array.isArray(details.categories) ? details.categories : [];
      return {
        tmdb_id: details.mediaId || '',
        title: details.title || '',
        overview: details.description || '',
        poster_url: details.thumbnail || '',
        release_year: releaseYear,
        genre_ids: genreIds,
        status: shelfStatus,
        progress: 0,
      };
    } else if (item.type === 'podcast') {
      const genreIds = Array.isArray(details.categories) ? details.categories : [];
      return {
        listen_notes_id: details.mediaId || '',
        title: details.title || '',
        publisher: details.authors || '',
        image: details.thumbnail || '',
        genre_ids: genreIds,
        status: shelfStatus,
        progress: 0,
      };
    }
    return {};
  };

  const handleAddToShelf = async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      setActionMessage('Please log in first to add items to your shelf.');
      return;
    }

    setActionMessage('');
    setAddingToShelf(true);
    try {
      const endpoint = getShelfEndpoint();
      const shelfData = prepareShelfData();

      if (item.type === 'book' && !shelfData.google_books_id) {
        setActionMessage('Book ID is missing. Try selecting a different book.');
        setAddingToShelf(false);
        return;
      }
      if (item.type === 'movie' && !shelfData.tmdb_id) {
        setActionMessage('Movie ID is missing. Try selecting a different movie.');
        setAddingToShelf(false);
        return;
      }
      if (item.type === 'podcast' && !shelfData.listen_notes_id) {
        setActionMessage('Podcast ID is missing. Try selecting a different podcast.');
        setAddingToShelf(false);
        return;
      }

      if (!shelfData.title || shelfData.title.trim() === '') {
        setActionMessage('Title is missing. Try selecting a different item.');
        setAddingToShelf(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(shelfData),
      });

      if (response.ok) {
        window.dispatchEvent(new Event('shelfUpdated'));
        onClose();
      } else {
        let errorMessage = 'Could not add to shelf. Try again.';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = String(errorData.error);
          } else if (errorData.detail) {
            errorMessage = String(errorData.detail);
          } else if (errorData.message) {
            errorMessage = String(errorData.message);
          } else if (typeof errorData === 'object' && Object.keys(errorData).length > 0) {
            const firstKey = Object.keys(errorData)[0];
            const firstError = errorData[firstKey];
            if (Array.isArray(firstError)) {
              errorMessage = `${firstKey}: ${firstError[0]}`;
            } else {
              errorMessage = `${firstKey}: ${firstError}`;
            }
          }
        } catch {
          /* keep default */
        }
        setActionMessage(errorMessage);
      }
    } catch (error) {
      console.error('Add to shelf error:', error);
      setActionMessage('Could not add to shelf. Try again.');
    } finally {
      setAddingToShelf(false);
    }
  };

  const handleAddToClubShelf = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setActionMessage('Please log in first to add to a club shelf.');
      return;
    }
    if (!selectedClubId) {
      setActionMessage('Choose a club where you are an admin.');
      return;
    }
    setActionMessage('');
    setAddingToClubShelf(true);
    try {
      const payload = prepareClubShelfPayload();
      if (item.type === 'book' && !payload.media_id) {
        setActionMessage('Book ID is missing.');
        return;
      }
      if (item.type === 'movie' && !payload.media_id) {
        setActionMessage('Movie ID is missing.');
        return;
      }
      if (item.type === 'podcast' && !payload.media_id) {
        setActionMessage('Podcast ID is missing.');
        return;
      }
      if (!payload.title?.trim()) {
        setActionMessage('Title is missing.');
        return;
      }
      const res = await fetch(`${API_BASE_URL}/clubs/${selectedClubId}/shelf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setActionMessage('Added to club shelf.');
        window.dispatchEvent(new Event('shelfUpdated'));
      } else {
        let msg = 'Could not add to club shelf. Try again.';
        try {
          const err = await res.json();
          msg = err.detail || err.non_field_errors?.[0] || err.media_id?.[0] || msg;
        } catch {
          /* ignore */
        }
        const raw = String(msg || '');
        const low = raw.toLowerCase();
        if (res.status === 409 || low.includes('already') || low.includes('exists') || low.includes('duplicate') || low.includes('unique')) {
          setActionMessage('Already in shelf');
        } else {
          setActionMessage(raw);
        }
      }
    } catch (e) {
      console.error(e);
      setActionMessage('Could not add to club shelf. Try again.');
    } finally {
      setAddingToClubShelf(false);
    }
  };

  const getStatusOptions = () => {
    if (item.type === 'book') {
      return [
        { value: 'WANT_TO_READ', label: 'Want to Read' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'FINISHED', label: 'Finished' },
      ];
    } else if (item.type === 'movie') {
      return [
        { value: 'WANT_TO_WATCH', label: 'Want to Watch' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'FINISHED', label: 'Finished' },
      ];
    } else if (item.type === 'podcast') {
      return [
        { value: 'WANT_TO_LISTEN', label: 'Want to Listen' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'FINISHED', label: 'Finished' },
      ];
    }
    return [];
  };

  return (
    <div className="media-detail-overlay" onClick={onClose}>
      <div className="media-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <div className="detail-content">
          <div className="detail-image-section">
            <img
              src={details.thumbnail || 'https://via.placeholder.com/300x400?text=No+Image'}
              alt={details.title}
              className="detail-thumbnail"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/300x400?text=No+Image';
              }}
            />
          </div>

          <div className="detail-info-section">
            <h2 className="detail-title">{details.title}</h2>
            <p className="detail-author">
              {item.type === 'book' ? 'Author' : item.type === 'movie' ? 'Year' : 'Publisher'}: {details.authors}
            </p>

            {details.publishedDate && (
              <p className="detail-meta">
                {item.type === 'book' ? 'Published' : item.type === 'movie' ? 'Released' : 'Published'}: {details.publishedDate.substring(0, 4)}
              </p>
            )}

            {details.categories && details.categories.length > 0 && (
              <p className="detail-genres">
                Genre: {item.type === 'movie' 
                  ? details.categories.join(', ') 
                  : details.categories.join(', ')}
              </p>
            )}

            <div className="detail-description">
              <h3>Description</h3>
              <p>{details.description}</p>
            </div>

            <div className="detail-actions detail-actions-stack">
              <select
                className="status-select"
                value={shelfStatus}
                onChange={(e) => setShelfStatus(e.target.value)}
              >
                {getStatusOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="add-to-shelf-btn"
                onClick={handleAddToShelf}
                disabled={addingToShelf || addingToClubShelf}
              >
                {addingToShelf ? 'Adding...' : 'Add to My Shelf'}
              </button>

              {adminClubs.length > 0 && (
                <div className="detail-club-shelf-row">
                  <label className="detail-club-label" htmlFor="club-shelf-select">Club shelf</label>
                  <select
                    id="club-shelf-select"
                    className="status-select club-shelf-select"
                    value={selectedClubId || ''}
                    onChange={(e) => setSelectedClubId(e.target.value ? Number(e.target.value) : '')}
                  >
                    {adminClubs.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="add-to-club-shelf-btn"
                    onClick={handleAddToClubShelf}
                    disabled={addingToShelf || addingToClubShelf || !selectedClubId}
                  >
                    {addingToClubShelf ? 'Adding...' : 'Add to Club Shelf'}
                  </button>
                </div>
              )}
              {actionMessage ? <p className="inline-form-msg">{actionMessage}</p> : null}
            </div>

            {item.type === 'book' && details.isbn && (
              <a
                href={`https://www.amazon.com/s?k=${details.isbn.replace(/-/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-buy-amazon"
              >
                Buy on Amazon
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaDetail;
