from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions, generics, views
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from users.models import Friendship
from .recommendations import build_recommendations_for_user
from .services import GoogleBooksService, TMDbService, ListenNotesService
from .models import (
    BookShelfItem,
    MovieShelfItem,
    PodcastShelfItem,
    Club,
    ClubMember,
    ClubShelfItem,
    ClubPoll,
    PollVote,
    ClubPost,
    ClubComment,
)
from .serializers import (
    BookShelfItemSerializer,
    MovieShelfItemSerializer,
    PodcastShelfItemSerializer,
    ClubSerializer,
    ClubShelfItemSerializer,
    ClubPollSerializer,
    PollVoteSerializer,
    ClubPostSerializer,
    ClubPostWriteSerializer,
    ClubCommentSerializer,
)


def _friend_ids(user):
    ids = set()
    for pk in Friendship.objects.filter(user1=user).values_list("user2_id", flat=True):
        ids.add(pk)
    for pk in Friendship.objects.filter(user2=user).values_list("user1_id", flat=True):
        ids.add(pk)
    return ids


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def shelf_friend_reviews(request):
    """Friend reviews for a shelf media item."""
    media_type = (request.query_params.get("media_type") or "").strip().lower()
    media_id = (request.query_params.get("media_id") or "").strip()
    if not media_id or media_type not in ("book", "movie", "podcast"):
        return Response(
            {"error": "media_type (book|movie|podcast) and media_id are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    friend_ids = _friend_ids(request.user)
    if not friend_ids:
        return Response([])
    results = []
    if media_type == "book":
        from .models import BookShelfItem
        items = BookShelfItem.objects.filter(
            user_id__in=friend_ids,
            google_books_id=media_id,
        ).exclude(review__isnull=True).exclude(review="").select_related("user")
    elif media_type == "movie":
        items = MovieShelfItem.objects.filter(
            user_id__in=friend_ids,
            tmdb_id=media_id,
        ).exclude(review__isnull=True).exclude(review="").select_related("user")
    else:
        items = PodcastShelfItem.objects.filter(
            user_id__in=friend_ids,
            listen_notes_id=media_id,
        ).exclude(review__isnull=True).exclude(review="").select_related("user")
    for item in items:
        u = item.user
        display = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
        results.append({
            "username": u.username,
            "display_name": display,
            "review": item.review,
            "updated_at": item.updated_at.isoformat(),
        })
    return Response(results)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def shelf_media_genre(request):
    """Genres for a media id from external APIs."""
    media_type = (request.query_params.get("media_type") or "").strip().lower()
    media_id = (request.query_params.get("media_id") or "").strip()
    if not media_id or media_type not in ("book", "movie", "podcast"):
        return Response(
            {"error": "media_type and media_id required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    genres = []
    if media_type == "book":
        data = GoogleBooksService().get_volume(media_id)
        if data and isinstance(data, dict):
            info = data.get("volumeInfo") or {}
            cats = info.get("categories") or []
            genres = [c for c in cats if isinstance(c, str) and c.strip()]
    elif media_type == "movie":
        data = TMDbService().get_movie_details(media_id)
        if data and isinstance(data, dict):
            id2name = TMDbService().get_genre_id_to_name()
            ids = data.get("genre_ids") or [g.get("id") for g in (data.get("genres") or []) if g.get("id")]
            genres = [id2name[i] for i in ids if i in id2name and id2name[i]]
    elif media_type == "podcast":
        raw = ListenNotesService().get_podcast(media_id)
        pod = raw.get("podcast") if isinstance(raw, dict) and isinstance(raw.get("podcast"), dict) else raw
        if isinstance(pod, dict):
            id2name = ListenNotesService().get_podcast_genre_id_to_name()
            ids = pod.get("genre_ids") or []
            if not isinstance(ids, list):
                ids = []
            for i in ids:
                try:
                    gid = int(i)
                except (TypeError, ValueError):
                    continue
                n = id2name.get(gid)
                if n:
                    genres.append(n)
    return Response({"genres": genres})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def shelf_stats(request):
    """Genre mix on your shelf: each label with count and % of genre tags."""
    user = request.user

    def genre_breakdown(queryset):
        count = {}
        for item in queryset:
            genres = getattr(item, "genres", None) or []
            if isinstance(genres, list):
                for g in genres:
                    s = str(g).strip()
                    if s:
                        count[s] = count.get(s, 0) + 1
        total = sum(count.values())
        if total == 0:
            return []
        rows = [
            {"genre": k, "count": v, "percent": round(100.0 * v / total, 1)}
            for k, v in count.items()
        ]
        rows.sort(key=lambda x: (-x["percent"], x["genre"].lower()))
        return rows

    books = BookShelfItem.objects.filter(user=user)
    movies = MovieShelfItem.objects.filter(user=user)
    podcasts = PodcastShelfItem.objects.filter(user=user)
    return Response({
        "books": {"genres": genre_breakdown(books)},
        "movies": {"genres": genre_breakdown(movies)},
        "podcasts": {"genres": genre_breakdown(podcasts)},
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def personalized_recommendations(request):
    data = build_recommendations_for_user(request.user)
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def cloudinary_config(request):
    cloud_name = getattr(settings, 'CLOUDINARY_CLOUD_NAME', '') or ''
    upload_preset = getattr(settings, 'CLOUDINARY_UPLOAD_PRESET', '') or ''
    return Response({
        'cloud_name': cloud_name,
        'upload_preset': upload_preset,
    })


def _safe_year(value):
    if not value:
        return None
    s = str(value)
    return int(s[:4]) if len(s) >= 4 and s[:4].isdigit() else None


def _matches_genre(genres, genre_filter):
    if not genre_filter:
        return True
    gf = str(genre_filter).strip().lower()
    if not gf:
        return True
    if isinstance(genres, list):
        return any(gf in str(g).lower() for g in genres)
    return gf in str(genres).lower()

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def search_books(request):
    query = request.query_params.get('q', '').strip()
    
    if not query:
        return Response(
            {'error': 'Query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    service = GoogleBooksService()
    results = service.search_books(query)
    
    return Response({
        'query': query,
        'results': results
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def search_movies(request):
    query = request.query_params.get('q', '').strip()

    if not query:
        return Response(
            {'error': 'Query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    service = TMDbService()
    data = service.search_movies(query)
    raw = data if isinstance(data, dict) else {}
    movie_list = raw.get('results')
    movie_list = movie_list if isinstance(movie_list, list) else []

    return Response({
        'query': query,
        'results': movie_list,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def search_podcasts(request):
    query = request.query_params.get('q', '').strip()

    if not query:
        return Response(
            {'error': 'Query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    service = ListenNotesService()
    data = service.search_podcasts(query)
    raw = data if isinstance(data, dict) else {}
    podcast_list = raw.get('results')
    podcast_list = podcast_list if isinstance(podcast_list, list) else []

    return Response({
        'query': query,
        'results': podcast_list,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def unified_search(request):
    try:
        query = request.query_params.get('q', '').strip()
        search_type = request.query_params.get('type', 'all').strip().lower()  # all/book/movie/podcast
        year = request.query_params.get('year', '').strip()
        genre = request.query_params.get('genre', '').strip()

        if not query:
            return Response(
                {'error': 'Query parameter is required', 'results': []},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_types = ['all', 'book', 'movie', 'podcast']
        if search_type not in valid_types:
            return Response(
                {'error': f'Invalid type. Must be one of: {", ".join(valid_types)}', 'results': []},
                status=status.HTTP_400_BAD_REQUEST
            )

        year_int = int(year) if year.isdigit() else None

        results = []

        def add_book_results():
            data = GoogleBooksService().search_books(query)
            if not isinstance(data, dict):
                data = {}
            items = data.get('items') if isinstance(data.get('items'), list) else []
            for item in items:
                info = item.get('volumeInfo', {}) if isinstance(item, dict) else {}
                published_year = _safe_year(info.get('publishedDate'))
                categories = info.get('categories', []) or []
                if year_int and published_year != year_int:
                    continue
                if genre and not _matches_genre(categories, genre):
                    continue
                results.append({
                    'type': 'book',
                    'title': info.get('title'),
                    'year': published_year,
                    'genres': categories,
                    'data': item,
                })

        def add_movie_results():
            service = TMDbService()
            data = service.search_movies(query)
            raw = data if isinstance(data, dict) else {}
            items = raw.get('results')
            items = items if isinstance(items, list) else []

            genre_id = int(genre) if genre.isdigit() else None
            if genre and not genre_id:
                genre_map = service.get_genre_map()
                genre_id = genre_map.get(genre.lower())

            for item in items:
                release_year = _safe_year(item.get('release_date')) if isinstance(item, dict) else None
                gids = item.get('genre_ids', []) if isinstance(item, dict) else []
                genre_ids = gids if isinstance(gids, list) else []
                if year_int and release_year != year_int:
                    continue
                if genre and genre_id and genre_id not in genre_ids:
                    continue
                results.append({
                    'type': 'movie',
                    'title': item.get('title') if isinstance(item, dict) else None,
                    'year': release_year,
                    'genres': genre_ids,
                    'data': item,
                })

        def add_podcast_results():
            data = ListenNotesService().search_podcasts(query)
            raw = data if isinstance(data, dict) else {}
            items = raw.get('results')
            items = items if isinstance(items, list) else []

            genre_id = int(genre) if genre.isdigit() else None
            for item in items:
                item = item if isinstance(item, dict) else {}
                gids = item.get('genre_ids') or []
                genre_ids = gids if isinstance(gids, list) else []
                # ListenNotes doesn't reliably expose a year on podcast search results,
                # so year filter will only work when a year field is present.
                candidate_year = (
                    _safe_year(item.get('first_published_at'))
                    or _safe_year(item.get('earliest_pub_date_ms'))
                    or _safe_year(item.get('latest_pub_date_ms'))
                    or _safe_year(item.get('pub_date_ms'))
                )

                if year_int and candidate_year != year_int:
                    continue
                if genre and genre_id and genre_id not in genre_ids:
                    continue
                if genre and not genre_id:
                    # best-effort text match
                    if not _matches_genre(item.get('description_original', ''), genre) and not _matches_genre(item.get('title_original', ''), genre):
                        continue

                results.append({
                    'type': 'podcast',
                    'title': item.get('title_original') or item.get('title'),
                    'year': candidate_year,
                    'genres': genre_ids,
                    'data': item,
                })

        if search_type in ('all', 'book'):
            add_book_results()
        if search_type in ('all', 'movie'):
            add_movie_results()
        if search_type in ('all', 'podcast'):
            add_podcast_results()

        
        hints = []
        if not getattr(settings, "TMDB_API_KEY", None) and search_type in ("all", "movie"):
            hints.append(
                "Movie search needs TMDB_API_KEY in .env (free: themoviedb.org/settings/api). "
                "Restart Django after adding it."
            )
        if not getattr(settings, "LISTENNOTES_API_KEY", None) and search_type in ("all", "podcast"):
            hints.append(
                "Podcast search needs LISTENNOTES_API_KEY in .env (free: listennotes.com/api). "
                "Restart Django after adding it."
            )
        if not results and search_type in ("all", "book"):
            if not getattr(settings, "GOOGLE_BOOKS_API_KEY", None):
                hints.append(
                    "Book search is rate-limited without GOOGLE_BOOKS_API_KEY "
                    "(console.cloud.google.com)."
                )

        response_data = {"query": query, "results": results}
        if hints:
            response_data["hints"] = hints
        return Response(response_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': 'Search failed. Try again.', 'results': []},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class BookShelfListCreateView(generics.ListCreateAPIView):
    serializer_class = BookShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.request.query_params.get("user_id", "").strip()
        if user_id.isdigit():
            uid = int(user_id)
            if uid != self.request.user.id:
                queryset = BookShelfItem.objects.filter(user_id=uid)
                status_param = self.request.query_params.get("status", "").strip().upper()
                if status_param:
                    queryset = queryset.filter(status=status_param)
                return queryset
        queryset = BookShelfItem.objects.filter(user=self.request.user)
        status_param = self.request.query_params.get("status", "").strip().upper()
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BookShelfDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BookShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BookShelfItem.objects.filter(user=self.request.user)


class MovieShelfListCreateView(generics.ListCreateAPIView):
    serializer_class = MovieShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.request.query_params.get("user_id", "").strip()
        if user_id.isdigit():
            uid = int(user_id)
            if uid != self.request.user.id:
                queryset = MovieShelfItem.objects.filter(user_id=uid)
                status_param = self.request.query_params.get("status", "").strip().upper()
                if status_param:
                    queryset = queryset.filter(status=status_param)
                return queryset
        queryset = MovieShelfItem.objects.filter(user=self.request.user)
        status_param = self.request.query_params.get("status", "").strip().upper()
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        genre_ids = self.request.data.get("genre_ids")
        if isinstance(genre_ids, list) and genre_ids:
            id2name = TMDbService().get_genre_id_to_name()
            genres = [id2name[g] for g in genre_ids if g in id2name]
        else:
            genres = serializer.validated_data.get("genres") or []
        serializer.save(user=self.request.user, genres=genres)


class MovieShelfDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MovieShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MovieShelfItem.objects.filter(user=self.request.user)


class PodcastShelfListCreateView(generics.ListCreateAPIView):
    serializer_class = PodcastShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.request.query_params.get("user_id", "").strip()
        if user_id.isdigit():
            uid = int(user_id)
            if uid != self.request.user.id:
                queryset = PodcastShelfItem.objects.filter(user_id=uid)
                status_param = self.request.query_params.get("status", "").strip().upper()
                if status_param:
                    queryset = queryset.filter(status=status_param)
                return queryset
        queryset = PodcastShelfItem.objects.filter(user=self.request.user)
        status_param = self.request.query_params.get("status", "").strip().upper()
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        genre_ids = self.request.data.get("genre_ids")
        genres = []
        if isinstance(genre_ids, list) and genre_ids and getattr(settings, "LISTENNOTES_API_KEY", None):
            id2name = ListenNotesService().get_podcast_genre_id_to_name()
            for raw in genre_ids:
                try:
                    gid = int(raw)
                except (TypeError, ValueError):
                    continue
                n = id2name.get(gid)
                if n:
                    genres.append(n)
        if not genres:
            genres = serializer.validated_data.get("genres") or []
        serializer.save(user=self.request.user, genres=genres)


class PodcastShelfDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PodcastShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PodcastShelfItem.objects.filter(user=self.request.user)


class ClubListCreateView(generics.ListCreateAPIView):
    serializer_class = ClubSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return Club.objects.all().distinct()
        return Club.objects.filter(
            Q(is_private=False) | Q(memberships__user=user)
        ).distinct()

    def perform_create(self, serializer):
        club = serializer.save(created_by=self.request.user)
        ClubMember.objects.create(
            user=self.request.user,
            club=club,
            role=ClubMember.Role.ADMIN,
        )


class JoinClubView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, club_id):
        try:
            club = get_object_or_404(Club, pk=club_id)
            
            # Check if user is already a member
            if ClubMember.objects.filter(user=request.user, club=club).exists():
                return Response(
                    {'error': 'You are already a member of this club'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Add user as a regular member
            ClubMember.objects.create(
                user=request.user,
                club=club,
                role=ClubMember.Role.MEMBER
            )
            
            return Response(
                {'message': 'Successfully joined the club'},
                status=status.HTTP_200_OK
            )
        except Club.DoesNotExist:
            return Response(
                {'error': 'Club not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': 'Failed to join club'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ClubDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ClubSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return Club.objects.all().distinct()
        return Club.objects.filter(
            Q(is_private=False) | Q(memberships__user=user)
        ).distinct()

    def perform_destroy(self, instance):
        user = self.request.user
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            instance.delete()
            return
        if instance.created_by_id == user.id:
            instance.delete()
            return
        if ClubMember.objects.filter(
            user=user, club=instance, role=ClubMember.Role.ADMIN
        ).exists():
            instance.delete()
            return
        raise PermissionDenied("Only club admins or the creator can delete this club.")


class ClubShelfItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ClubShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_club(self):
        return get_object_or_404(Club, pk=self.kwargs.get("club_id"))

    def _ensure_member(self, club):
        if getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False):
            return
        if not ClubMember.objects.filter(user=self.request.user, club=club).exists():
            raise PermissionDenied("You are not a member of this club.")

    def _ensure_admin(self, club):
        if getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False):
            return
        if not ClubMember.objects.filter(
            user=self.request.user,
            club=club,
            role=ClubMember.Role.ADMIN,
        ).exists():
            raise PermissionDenied("Only club admins can add items.")

    def get_queryset(self):
        club = self.get_club()
        self._ensure_member(club)
        return ClubShelfItem.objects.filter(club=club)

    def perform_create(self, serializer):
        club = self.get_club()
        self._ensure_admin(club)
        serializer.save(club=club)


class ClubShelfItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClubShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_club(self):
        return get_object_or_404(Club, pk=self.kwargs.get("club_id"))

    def get_object(self):
        club = self.get_club()
        item = get_object_or_404(
            ClubShelfItem, pk=self.kwargs.get("pk"), club=club
        )

        membership = ClubMember.objects.filter(user=self.request.user, club=club).first()
        if not (getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False)) and membership is None:
            raise PermissionDenied("You are not a member of this club.")

        if self.request.method in ("PUT", "PATCH", "DELETE"):
            if not (getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False)) and (membership is None or membership.role != ClubMember.Role.ADMIN):
                raise PermissionDenied("Only club admins can modify items.")

        return item


def _get_club_and_membership(view_instance, club_id):
    club = get_object_or_404(Club, pk=club_id)
    membership = ClubMember.objects.filter(
        user=view_instance.request.user, club=club
    ).first()
    if membership is None and not (getattr(view_instance.request.user, "is_staff", False) or getattr(view_instance.request.user, "is_superuser", False)):
        raise PermissionDenied("You are not a member of this club.")
    return club, membership


class ClubPollListCreateView(generics.ListCreateAPIView):
    serializer_class = ClubPollSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        return ClubPoll.objects.filter(club=club)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        club, membership = _get_club_and_membership(self, self.kwargs["club_id"])
        if not (getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False)) and (membership is None or membership.role != ClubMember.Role.ADMIN):
            raise PermissionDenied("Only club admins can create polls.")
        serializer.save(club=club, created_by=self.request.user)


class ClubPollDetailView(generics.RetrieveAPIView):
    serializer_class = ClubPollSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        return ClubPoll.objects.filter(club=club)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class PollVoteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, club_id, poll_id):
        club = get_object_or_404(Club, pk=club_id)
        poll = get_object_or_404(ClubPoll, pk=poll_id, club=club)
        if poll.is_closed:
            return Response(
                {"error": "This poll is closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        choice = request.data.get("choice")
        if choice in (1, 2):
            choice = int(choice)
        elif choice in ("1", "2"):
            choice = int(choice)
        else:
            return Response(
                {"error": "choice must be 1 or 2."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        PollVote.objects.update_or_create(
            poll=poll,
            user=request.user,
            defaults={"choice": choice},
        )
        serializer = ClubPollSerializer(poll, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClubPostListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return ClubPostWriteSerializer if self.request.method == "POST" else ClubPostSerializer

    def get_queryset(self):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        return ClubPost.objects.filter(club=club).select_related("shelf_item", "created_by")

    def perform_create(self, serializer):
        club, membership = _get_club_and_membership(self, self.kwargs["club_id"])
        if not (getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False)) and (membership is None or membership.role != ClubMember.Role.ADMIN):
            raise PermissionDenied("Only club admins can create posts.")
        serializer.save(club=club, created_by=self.request.user)


class ClubPostDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return ClubPostWriteSerializer if self.request.method in ("PUT", "PATCH") else ClubPostSerializer

    def get_queryset(self):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        return ClubPost.objects.filter(club=club).select_related("shelf_item", "created_by")

    def get_object(self):
        qs = self.get_queryset()
        post = get_object_or_404(qs, pk=self.kwargs["pk"])
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            membership = ClubMember.objects.filter(user=self.request.user, club=post.club).first()
            if not (getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False)) and (membership is None or membership.role != ClubMember.Role.ADMIN):
                raise PermissionDenied("Only club admins can edit or delete posts.")
        return post


class ClubCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = ClubCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        post = get_object_or_404(ClubPost, pk=self.kwargs["post_id"], club=club)
        return ClubComment.objects.filter(post=post).select_related("user")

    def perform_create(self, serializer):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        post = get_object_or_404(ClubPost, pk=self.kwargs["post_id"], club=club)
        serializer.save(post=post, user=self.request.user)


class ClubCommentDetailView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        club, _ = _get_club_and_membership(self, self.kwargs["club_id"])
        post = get_object_or_404(ClubPost, pk=self.kwargs["post_id"], club=club)
        return ClubComment.objects.filter(post=post)

    def get_object(self):
        comment = super().get_object()
        user = self.request.user
        if comment.user_id == user.id:
            return comment
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return comment
        membership = ClubMember.objects.filter(user=user, club=comment.post.club).first()
        if membership and membership.role == ClubMember.Role.ADMIN:
            return comment
        raise PermissionDenied("You can only delete your own comment.")
