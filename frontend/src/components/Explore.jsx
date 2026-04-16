import { useState, useEffect, useRef } from 'react';
import './Explore.css';
import MediaDetail from './MediaDetail';

const API = '/api/media/recommendations/';
const SCROLL_STEP = 280;

const ROWS = [
  { key: 'preference_books', title: 'More books from your favorite genres' },
  { key: 'preference_movies', title: 'More movies from your favorite genres' },
  { key: 'preference_podcasts', title: 'More podcasts from your favorite genres' },
  { key: 'friends_shelf', title: 'What your friends have on their shelves' },
  { key: 'shelf_mixed', title: 'From your shelf you might be interested in' },
  {key: 'cross_movies_from_books_podcasts', title: 'Movies that match your books & podcasts'},
  {key: 'cross_books_from_movies_podcasts', title: 'Books that match your movies & podcasts'},
  { key: 'discover_books', title: 'Discover — books from top genres and popular fiction' },
  { key: 'discover_movies', title: 'Discover — movies tuned to your taste' },
  { key: 'popular_books', title: 'Trending books — bestseller fiction' },
  { key: 'popular_movies', title: 'Popular movies right now' },
];

function CarouselRow({ title, items, onPick, emptyHint }) {
  const trackRef = useRef(null);
  const scrollPrev = () => {
    trackRef.current?.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
  };
  const scrollNext = () => {
    trackRef.current?.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
  };

  return (
    <section className="explore-row">
      <div className="explore-row-head">
        <h2 className="explore-row-title">{title}</h2>
        <div className="explore-scroll-pair">
          <button type="button" className="explore-scroll-btn" onClick={scrollPrev} aria-label="Scroll left">
            ←
          </button>
          <button type="button" className="explore-scroll-btn" onClick={scrollNext} aria-label="Scroll right">
            →
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="explore-empty">
          {emptyHint || 'Add interests and shelf items.'}
        </p>
      ) : (
        <div className="explore-track-wrap">
          <div className="explore-track" ref={trackRef}>
            {items.map((item, i) => (
              <button
                type="button"
                key={`${item.type}-${String(item.data?.id ?? '')}-${i}`}
                className="explore-card"
                onClick={() => onPick(item)}
              >
                <div className="explore-card-media">
                  <img
                    src={thumb(item) || 'https://via.placeholder.com/180?text=+'}
                    alt=""
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/180?text=+'; }}
                  />
                </div>
                <span className="explore-card-title">{titleOf(item)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function thumb(item) {
  if (item.type === 'book') {
    const info = item.data?.volumeInfo || {};
    return info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
  }
  if (item.type === 'movie') {
    const d = item.data || {};
    const p = d.poster_url || d.poster_path;
    if (!p) return '';
    return String(p).startsWith('http') ? p : `https://image.tmdb.org/t/p/w342${p}`;
  }
  if (item.type === 'podcast') {
    return item.data?.image || item.data?.thumbnail || '';
  }
  return '';
}

function titleOf(item) {
  if (item.type === 'book') return item.data?.volumeInfo?.title || item.title || 'Book';
  if (item.type === 'movie') return item.data?.title || item.title || 'Movie';
  return item.data?.title_original || item.data?.title || item.title || 'Podcast';
}

function Explore() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr('');
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
        const data = res.ok ? await res.json() : {};
        if (!res.ok) {
          setErr(data.detail || 'Could not load Explore');
          setPayload(null);
        } else {
          setPayload(data);
        }
      } catch (e) {
        setErr(e.message || 'Network error');
        setPayload(null);
      } finally {
        setLoading(false);
      }
    };
    load();
    const onShelf = () => load();
    window.addEventListener('shelfUpdated', onShelf);
    return () => window.removeEventListener('shelfUpdated', onShelf);
  }, []);

  const based = payload?.based_on;

  return (
    <div className="explore-page">
      <header className="explore-top">
        <h1 className="explore-brand">Explore</h1>
        {based?.interests?.length > 0 && (
          <p className="explore-prefs">
            <strong>Your sign-up genres:</strong> {based.interests.join(', ')}
          </p>
        )}
      </header>

      {loading && <p className="explore-loading">Loading…</p>}
      {err && <p className="explore-error">{err}</p>}

      {!loading && !err && payload && (
        <>
          {ROWS.map(({ key, title, emptyHint }) => (
            <CarouselRow
              key={key}
              title={title}
              items={Array.isArray(payload[key]) ? payload[key] : []}
              onPick={setSelectedItem}
              emptyHint={emptyHint}
            />
          ))}
        </>
      )}

      {selectedItem && <MediaDetail item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

export default Explore;
