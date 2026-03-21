import requests
from django.conf import settings


class GoogleBooksService:
    BASE_URL = "https://www.googleapis.com/books/v1/volumes"

    def search_books(self, query, max_results=10):
        params = {"q": query, "maxResults": max_results}
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
    BASE_URL = "https://api.themoviedb.org/3/search/movie"
    GENRES_URL = "https://api.themoviedb.org/3/genre/movie/list"
    _genre_map_cache = None
    _genre_id_to_name_cache = None

    def search_movies(self, query, max_results=10):
        if not settings.TMDB_API_KEY:
            print("TMDb API Key not configured")
            return {}
        params = {"query": query, "page": 1, "api_key": settings.TMDB_API_KEY}
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and "results" in data and max_results:
                data["results"] = data["results"][:max_results]
            return data
        except requests.exceptions.RequestException as e:
            print(f"TMDb API Error: {e}")
            return {}

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


class ListenNotesService:
    BASE_URL = "https://listen-api.listennotes.com/api/v2/search"

    def search_podcasts(self, query, max_results=10):
        if not settings.LISTENNOTES_API_KEY:
            print("ListenNotes API Key not configured")
            return {}
        params = {
            "q": query,
            "type": "podcast",
            "page_size": min(int(max_results), 10),
        }
        headers = {"X-ListenAPI-Key": settings.LISTENNOTES_API_KEY}
        try:
            response = requests.get(self.BASE_URL, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"ListenNotes API Error: {e}")
            return {}
