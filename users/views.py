from django.shortcuts import render
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, Friendship
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
    PublicProfileSerializer,
)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)
    
class LoginView(APIView):

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username_or_email = (request.data.get('username_or_email') or '').strip()
        password = request.data.get('password')
        
        if not username_or_email or not password:
            return Response(
                {'error': 'Please provide both username/email and password'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user by username (case-insensitive) or email (case-insensitive)
        user_obj = (
            User.objects.filter(username__iexact=username_or_email).first()
            or User.objects.filter(email__iexact=username_or_email).first()
        )
        if not user_obj:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        user = authenticate(request=request, username=user_obj.username, password=password)
        if user is None:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'Login successful'
        }, status=status.HTTP_200_OK)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {'message': 'Logout successful'},
                status=status.HTTP_200_OK
            )
        except Exception:
            return Response(
                {'error': 'Invalid token'},
                status=status.HTTP_400_BAD_REQUEST
            )

class MyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

class UpdateProfileView(generics.UpdateAPIView):
    
    serializer_class = UserUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


def _are_friends(user_a, user_b):
    if user_a.id == user_b.id:
        return True
    u1, u2 = (user_a.id, user_b.id) if user_a.id < user_b.id else (user_b.id, user_a.id)
    return Friendship.objects.filter(user1_id=u1, user2_id=u2).exists()


class ProfileByIdView(APIView):
    """GET profile by user id. Returns public profile + is_self, is_friend."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        data = PublicProfileSerializer(user).data
        data["is_self"] = request.user.id == user.id
        data["is_friend"] = _are_friends(request.user, user)
        return Response(data)


class AddFriendView(APIView):
    """POST to add a user as friend (mutual friendship)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.id == pk:
            return Response(
                {"error": "You cannot add yourself as a friend."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            other = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        u1, u2 = (request.user.id, other.id) if request.user.id < other.id else (other.id, request.user.id)
        _, created = Friendship.objects.get_or_create(user1_id=u1, user2_id=u2)
        return Response(
            {"message": "Friend added." if created else "Already friends."},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )