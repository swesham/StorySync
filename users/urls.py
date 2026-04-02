from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .import views

app_name = 'users'

urlpatterns = [
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/me/', views.MyProfileView.as_view(), name='my_profile'),
    path('profile/me/friends/', views.MyFriendsListView.as_view(), name='my_friends'),
    path('profile/update/', views.UpdateProfileView.as_view(), name='update_profile'),
    path('profile/<int:pk>/', views.ProfileByIdView.as_view(), name='profile_by_id'),
    path('profile/<int:pk>/friends/', views.UserFriendsListView.as_view(), name='user_friends'),
    path('profile/<int:pk>/add-friend/', views.AddFriendView.as_view(), name='add_friend'),
    path('chat/<int:pk>/messages/', views.ChatMessageListAPI.as_view(), name='chat_messages'),
    path('chat/notifications/', views.ChatNotificationsListView.as_view(), name='chat_notifications'),
    path('chat/partners/', views.ChatPartnersListView.as_view(), name='chat_partners'),
    path('profile/delete/', views.DeleteAccountView.as_view(), name='delete_account'),
]