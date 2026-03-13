from django.urls import path
from . import views

app_name = 'media'

urlpatterns = [
    path('cloudinary-config/', views.cloudinary_config, name='cloudinary_config'),
    path('search/books/', views.search_books, name='search_books'),
    path('search/movies/', views.search_movies, name='search_movies'),
    path('search/podcasts/', views.search_podcasts, name='search_podcasts'),
    path('search/', views.unified_search, name='unified_search'),
    path('clubs/', views.ClubListCreateView.as_view(), name='club_list'),
    path('clubs/<int:pk>/', views.ClubDetailView.as_view(), name='club_detail'),
    path('clubs/<int:club_id>/join/', views.JoinClubView.as_view(), name='join_club'),
    path('clubs/<int:club_id>/shelf/', views.ClubShelfItemListCreateView.as_view(), name='club_shelf_list'),
    path('clubs/<int:club_id>/shelf/<int:pk>/', views.ClubShelfItemDetailView.as_view(), name='club_shelf_detail'),
    path('clubs/<int:club_id>/polls/', views.ClubPollListCreateView.as_view(), name='club_poll_list'),
    path('clubs/<int:club_id>/polls/<int:pk>/', views.ClubPollDetailView.as_view(), name='club_poll_detail'),
    path('clubs/<int:club_id>/polls/<int:poll_id>/vote/', views.PollVoteView.as_view(), name='poll_vote'),
    path('clubs/<int:club_id>/posts/', views.ClubPostListCreateView.as_view(), name='club_post_list'),
    path('clubs/<int:club_id>/posts/<int:pk>/', views.ClubPostDetailView.as_view(), name='club_post_detail'),
    path('clubs/<int:club_id>/posts/<int:post_id>/comments/', views.ClubCommentListCreateView.as_view(), name='club_comment_list'),
    path('clubs/<int:club_id>/posts/<int:post_id>/comments/<int:pk>/', views.ClubCommentDetailView.as_view(), name='club_comment_detail'),
    path('shelf/books/', views.BookShelfListCreateView.as_view(), name='book_shelf_list'),
    path('shelf/books/<int:pk>/', views.BookShelfDetailView.as_view(), name='book_shelf_detail'),
    path('shelf/movies/', views.MovieShelfListCreateView.as_view(), name='movie_shelf_list'),
    path('shelf/movies/<int:pk>/', views.MovieShelfDetailView.as_view(), name='movie_shelf_detail'),
    path('shelf/podcasts/', views.PodcastShelfListCreateView.as_view(), name='podcast_shelf_list'),
    path('shelf/podcasts/<int:pk>/', views.PodcastShelfDetailView.as_view(), name='podcast_shelf_detail'),
]
