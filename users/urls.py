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
    path('profile/update/', views.UpdateProfileView.as_view(), name='update_profile'),
    path('profile/<int:pk>/', views.ProfileByIdView.as_view(), name='profile_by_id'),
    path('profile/<int:pk>/add-friend/', views.AddFriendView.as_view(), name='add_friend'),
]