import requests
from django.conf import settings


def _safe_int(n, default):
    try:
        return int(n)
    except (TypeError, ValueError):
        return default


class GoogleBooksService:
    # Google Books volume search
    BASE_URL = "https://www.googleapis.com/books/v1/volumes"

    def search_books(self, query, max_results=10, order_by=None):
        params = {"q": query, "maxResults": max_results}
        if order_by in ("newest", "relevance"):
            params["orderBy"] = order_by
        if getattr(settings, "GOOGLE_BOOKS_API_KEY", None):
            params["key"] = settings.GOOGLE_BOOKS_API_KEY
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"items": []}
            if data.get("error"):
                return {"items": []}
            return data
        except requests.exceptions.RequestException as e:
            err_msg = str(e)
            if hasattr(e, "response") and e.response is not None:
                try:
                    err_body = e.response.text[:200] if e.response.text else ""
                    err_msg = f"{e.response.status_code} {err_body}"
                except Exception:
                    pass
            print(f"Google Books API Error: {err_msg}")
            return {"items": []}

    def get_volume(self, volume_id):
        if not volume_id:
            return None
        params = {}
        if getattr(settings, "GOOGLE_BOOKS_API_KEY", None):
            params["key"] = settings.GOOGLE_BOOKS_API_KEY
        try:
            response = requests.get(f"{self.BASE_URL}/{volume_id}", params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException:
            return None


class TMDbService:
    # TMDb movie search + genre list 
    BASE_URL = "https://api.themoviedb.org/3/search/movie"
    GENRES_URL = "https://api.themoviedb.org/3/genre/movie/list"
    _genre_map_cache = None
    _genre_id_to_name_cache = None

    def search_movies(self, query, max_results=10):
        if not settings.TMDB_API_KEY:
            print("TMDb API Key not configured")
            return {"results": []}
        cap = _safe_int(max_results, 10) or 10
        params = {"query": query, "page": 1, "api_key": settings.TMDB_API_KEY}
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"results": []}
            rows = data.get("results")
            if not isinstance(rows, list):
                rows = []
            data["results"] = rows[:cap] if cap else rows
            return data
        except requests.exceptions.RequestException as e:
            print(f"TMDb API Error: {e}")
            return {"results": []}

    def get_genre_map(self):
        if self._genre_map_cache is not None:
            return self._genre_map_cache
        if not settings.TMDB_API_KEY:
            self._genre_map_cache = {}
            return self._genre_map_cache
        try:
            response = requests.get(
                self.GENRES_URL,
                params={"api_key": settings.TMDB_API_KEY},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            genres = data.get("genres", []) if isinstance(data, dict) else []
            self._genre_map_cache = {g.get("name", "").lower(): g.get("id") for g in genres if g.get("id")}
            return self._genre_map_cache
        except requests.exceptions.RequestException:
            print("TMDb Genre List API Error")
            self._genre_map_cache = {}
            return self._genre_map_cache

    def get_genre_id_to_name(self):
        if self._genre_id_to_name_cache is not None:
            return self._genre_id_to_name_cache
        if not settings.TMDB_API_KEY:
            self._genre_id_to_name_cache = {}
            return self._genre_id_to_name_cache
        try:
            response = requests.get(
                self.GENRES_URL,
                params={"api_key": settings.TMDB_API_KEY},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            genres = data.get("genres", []) if isinstance(data, dict) else []
            self._genre_id_to_name_cache = {g["id"]: g.get("name", "") for g in genres if g.get("id")}
            self._genre_map_cache = {g.get("name", "").lower(): g.get("id") for g in genres if g.get("id")}
            return self._genre_id_to_name_cache
        except requests.exceptions.RequestException:
            self._genre_id_to_name_cache = {}
            return self._genre_id_to_name_cache

    def get_movie_details(self, movie_id):
        if not settings.TMDB_API_KEY or not movie_id:
            return None
        try:
            response = requests.get(
                f"https://api.themoviedb.org/3/movie/{movie_id}",
                params={"api_key": settings.TMDB_API_KEY},
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException:
            return None

    def discover_movies(self, with_genre_ids=None, max_results=10):
        if not settings.TMDB_API_KEY:
            return {"results": []}
        cap = _safe_int(max_results, 12) or 12
        url = "https://api.themoviedb.org/3/discover/movie"
        params = {
            "api_key": settings.TMDB_API_KEY,
            "sort_by": "popularity.desc",
            "page": 1,
        }
        if with_genre_ids:
            clean = []
            for x in with_genre_ids:
                if x is None:
                    continue
                try:
                    clean.append(str(int(x)))
                except (TypeError, ValueError):
                    continue
            clean = clean[:5]
            if clean:
                params["with_genres"] = "|".join(clean)
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"results": []}
            rows = data.get("results")
            if not isinstance(rows, list):
                rows = []
            data["results"] = rows[:cap] if cap else rows
            return data
        except requests.exceptions.RequestException as e:
            print(f"TMDb discover Error: {e}")
            return {"results": []}


class ListenNotesService:
    # Listen Notes search + genre labels (for shelf / analytics)
    BASE_URL = "https://listen-api.listennotes.com/api/v2/search"
    GENRES_URL = "https://listen-api.listennotes.com/api/v2/genres"
    _podcast_genre_id_to_name = None

    def _ln_headers(self):
        key = getattr(settings, "LISTENNOTES_API_KEY", None) or ""
        return {"X-ListenAPI-Key": key} if key else {}

    def get_podcast_genre_id_to_name(self):
        if self._podcast_genre_id_to_name is not None:
            return self._podcast_genre_id_to_name
        if not settings.LISTENNOTES_API_KEY:
            self._podcast_genre_id_to_name = {}
            return self._podcast_genre_id_to_name
        try:
            response = requests.get(self.GENRES_URL, headers=self._ln_headers(), timeout=10)
            response.raise_for_status()
            data = response.json()
            rows = data.get("genres", []) if isinstance(data, dict) else []
            m = {}
            for g in rows:
                if not isinstance(g, dict):
                    continue
                gid = g.get("id")
                name = (g.get("name") or "").strip()
                if gid is not None and name:
                    try:
                        m[int(gid)] = name
                    except (TypeError, ValueError):
                        pass
            self._podcast_genre_id_to_name = m
            return self._podcast_genre_id_to_name
        except requests.exceptions.RequestException as e:
            print(f"ListenNotes genres API Error: {e}")
            self._podcast_genre_id_to_name = {}
            return self._podcast_genre_id_to_name

    def get_podcast(self, podcast_id):
        if not settings.LISTENNOTES_API_KEY or not podcast_id:
            return None
        url = f"https://listen-api.listennotes.com/api/v2/podcasts/{podcast_id}"
        try:
            response = requests.get(url, headers=self._ln_headers(), timeout=10)
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else None
        except requests.exceptions.RequestException:
            return None

    def get_best_podcasts(self, genre_id=None, max_results=10):
        """Listen Notes curated “best” list (popular in their directory)."""
        if not settings.LISTENNOTES_API_KEY:
            return []
        n = max(1, min(_safe_int(max_results, 10) or 10, 20))
        url = "https://listen-api.listennotes.com/api/v2/best_podcasts"
        params = {"page_size": n}
        if genre_id is not None:
            try:
                params["genre_id"] = int(genre_id)
            except (TypeError, ValueError):
                pass
        try:
            response = requests.get(url, params=params, headers=self._ln_headers(), timeout=10)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return []
            rows = data.get("podcasts")
            if not isinstance(rows, list):
                rows = data.get("results") or []
            return rows if isinstance(rows, list) else []
        except requests.exceptions.RequestException as e:
            print(f"ListenNotes best_podcasts Error: {e}")
            return []

    def search_podcasts(self, query, max_results=10, genre_ids=None):
        if not settings.LISTENNOTES_API_KEY:
            print("ListenNotes API Key not configured")
            return {"results": []}
        n = _safe_int(max_results, 10) or 10
        page_size = max(1, min(n, 10))
        params = {
            "q": query or "podcast",
            "type": "podcast",
            "page_size": page_size,
        }
        if genre_ids:
            parts = []
            for x in genre_ids:
                if x is None:
                    continue
                try:
                    parts.append(str(int(x)))
                except (TypeError, ValueError):
                    continue
            gstr = ",".join(parts[:8])
            if gstr:
                params["genre_ids"] = gstr
        try:
            response = requests.get(self.BASE_URL, params=params, headers=self._ln_headers(), timeout=10)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"results": []}
            rows = data.get("results")
            if not isinstance(rows, list):
                data["results"] = []
            return data
        except requests.exceptions.RequestException as e:
            # Handle rate limit specifically
            if hasattr(e, 'response') and e.response is not None:
                if e.response.status_code == 429:
                    print("ListenNotes API rate limit exceeded. Please wait before retrying.")
                    return {"results": []}
            print(f"ListenNotes search Error: {e}")
            return {"results": []}
