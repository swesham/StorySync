from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import status, permissions, generics, views
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def cloudinary_config(request):
    """Return Cloudinary cloud_name and upload_preset for client-side unsigned uploads."""
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
    results = service.search_movies(query)

    return Response({
        'query': query,
        'results': results
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
    results = service.search_podcasts(query)

    return Response({
        'query': query,
        'results': results
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
            items = data.get('results', []) if isinstance(data, dict) else []

            genre_id = int(genre) if genre.isdigit() else None
            if genre and not genre_id:
                genre_map = service.get_genre_map()
                genre_id = genre_map.get(genre.lower())

            for item in items:
                release_year = _safe_year(item.get('release_date')) if isinstance(item, dict) else None
                genre_ids = item.get('genre_ids', []) if isinstance(item, dict) else []
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
            items = data.get('results', []) if isinstance(data, dict) else []

            genre_id = int(genre) if genre.isdigit() else None
            for item in items:
                item = item if isinstance(item, dict) else {}
                genre_ids = item.get('genre_ids', []) or []
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

        hint = None
        if not results and search_type in ('all', 'book'):
            if not getattr(settings, 'GOOGLE_BOOKS_API_KEY', None):
                hint = (
                    'Book search is rate-limited without an API key. '
                    'Add a free GOOGLE_BOOKS_API_KEY in .env (get one at console.cloud.google.com).'
                )
        response_data = {'query': query, 'results': results}
        if hint:
            response_data['hint'] = hint
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
        queryset = MovieShelfItem.objects.filter(user=self.request.user)
        status_param = self.request.query_params.get("status", "").strip().upper()
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MovieShelfDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MovieShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MovieShelfItem.objects.filter(user=self.request.user)


class PodcastShelfListCreateView(generics.ListCreateAPIView):
    serializer_class = PodcastShelfItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = PodcastShelfItem.objects.filter(user=self.request.user)
        status_param = self.request.query_params.get("status", "").strip().upper()
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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


class ClubDetailView(generics.RetrieveAPIView):
    serializer_class = ClubSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return Club.objects.all().distinct()
        return Club.objects.filter(
            Q(is_private=False) | Q(memberships__user=user)
        ).distinct()


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
        if membership is None and not (getattr(self.request.user, "is_staff", False) or getattr(self.request.user, "is_superuser", False)):
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
        if comment.user_id != self.request.user.id:
            raise PermissionDenied("You can only delete your own comment.")
        return comment
