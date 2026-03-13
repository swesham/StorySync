import { useState, useEffect } from 'react';
import './MediaDetail.css';

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

  const API_BASE_URL = '/api/media';

  const getDetails = () => {
    if (item.type === 'book') {
      const info = item.data?.volumeInfo || {};
      return {
        title: info.title || 'Unknown Title',
        authors: info.authors?.join(', ') || 'Unknown Author',
        description: info.description || 'No description available',
        thumbnail: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '',
        publishedDate: info.publishedDate || '',
        categories: info.categories || [],
        pageCount: info.pageCount || 0,
        mediaId: item.data?.id || '',
      };
    } else if (item.type === 'movie') {
      const movieData = item.data || {};
      const movieId = movieData.id ? String(movieData.id).trim() : '';
      
      if (!movieId) {
        console.warn('Movie ID missing. Available fields:', Object.keys(movieData));
        console.warn('Full movie data:', movieData);
      }
      
      return {
        title: movieData.title || 'Unknown Title',
        authors: movieData.release_date?.substring(0, 4) || 'Unknown Year',
        description: movieData.overview || 'No description available',
        thumbnail: movieData.poster_path 
          ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
          : '',
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
        status: shelfStatus,
        progress: 0,
      };
    } else if (item.type === 'movie') {
      const releaseYear = details.publishedDate && details.publishedDate.length >= 4
        ? parseInt(details.publishedDate.substring(0, 4))
        : null;
      
      return {
        tmdb_id: details.mediaId || '',
        title: details.title || '',
        overview: details.description || '',
        poster_url: details.thumbnail || '',
        release_year: releaseYear,
        status: shelfStatus,
        progress: 0,
      };
    } else if (item.type === 'podcast') {
      return {
        listen_notes_id: details.mediaId || '',
        title: details.title || '',
        publisher: details.authors || '',
        image: details.thumbnail || '',
        status: shelfStatus,
        progress: 0,
      };
    }
    return {};
  };

  const handleAddToShelf = async () => {
    const token = localStorage.getItem('access_token'); 
    
    if (!token) {
      alert('Please login first to add items to your shelf');
      return;
    }

    setAddingToShelf(true);
    try {
      const endpoint = getShelfEndpoint();
      const shelfData = prepareShelfData();

      if (item.type === 'book' && !shelfData.google_books_id) {
        alert('Error: Book ID is missing. Please try selecting a different book.');
        setAddingToShelf(false);
        return;
      }
      if (item.type === 'movie' && !shelfData.tmdb_id) {
        alert('Error: Movie ID is missing. Please try selecting a different movie.');
        console.error('Movie data missing tmdb_id. Details:', details);
        console.error('Item data:', item.data);
        setAddingToShelf(false);
        return;
      }
      if (item.type === 'podcast' && !shelfData.listen_notes_id) {
        alert('Error: Podcast ID is missing. Please try selecting a different podcast.');
        console.error('Podcast data missing listen_notes_id. Details:', details);
        console.error('Item data:', item.data);
        setAddingToShelf(false);
        return;
      }
      
      if (!shelfData.title || shelfData.title.trim() === '') {
        alert('Error: Title is missing. Please try selecting a different item.');
        setAddingToShelf(false);
        return;
      }

      console.log('Sending to:', endpoint);
      console.log('Sending data:', JSON.stringify(shelfData, null, 2));
      console.log('Item type:', item.type);
      console.log('Item data:', item.data);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(shelfData),
      });

      if (response.ok) {
        alert('Successfully added to your shelf!');
        window.dispatchEvent(new Event('shelfUpdated'));
        onClose();
      } else {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('Add to shelf error response:', errorData);
          console.error('Request data sent:', shelfData);
          
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'object' && Object.keys(errorData).length > 0) {

            const firstKey = Object.keys(errorData)[0];
            const firstError = errorData[firstKey];
            if (Array.isArray(firstError)) {
              errorMessage = `${firstKey}: ${firstError[0]}`;
            } else {
              errorMessage = `${firstKey}: ${firstError}`;
            }
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (e) {
          const textResponse = await response.text().catch(() => '');
          console.error('Response text:', textResponse);
          if (textResponse) {
            errorMessage = textResponse.substring(0, 200);
          }
        }
        
        alert(`Failed to add to shelf: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Add to shelf error:', error);
      alert('Failed to add to shelf. Please try again.');
    } finally {
      setAddingToShelf(false);
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

            <div className="detail-actions">
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
                className="add-to-shelf-btn"
                onClick={handleAddToShelf}
                disabled={addingToShelf}
              >
                {addingToShelf ? 'Adding...' : 'Add to My Shelf'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaDetail;
