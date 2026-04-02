from django.db.models import Q
from django.shortcuts import render
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, Friendship, ChatMessage
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
    PublicProfileSerializer,
    FriendSerializer,
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
        try:
            username_or_email = (request.data.get('username_or_email') or '').strip()
            password = request.data.get('password')
        except Exception:
            return Response(
                {'error': 'Invalid request body'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not username_or_email or not password:
            return Response(
                {'error': 'Please provide both username/email and password'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

        try:
            refresh = RefreshToken.for_user(user)
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email or '',
                'first_name': user.first_name or '',
                'last_name': user.last_name or '',
                'is_staff': getattr(user, 'is_staff', False),
                'is_superuser': getattr(user, 'is_superuser', False),
            }
            return Response({
                'user': user_data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': 'Login failed.', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
        serializer = UserProfileSerializer(request.user, context={'request': request})
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
    """Public profile by user id."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        data = PublicProfileSerializer(user, context={'request': request}).data
        data["is_self"] = request.user.id == user.id
        data["is_friend"] = _are_friends(request.user, user)
        return Response(data)


class AddFriendView(APIView):
    """Add a friend."""
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


class MyFriendsListView(APIView):
    """Current user's friends."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        friend_ids = set()
        for f in Friendship.objects.filter(user1=user).values_list("user2_id", flat=True):
            friend_ids.add(f)
        for f in Friendship.objects.filter(user2=user).values_list("user1_id", flat=True):
            friend_ids.add(f)
        friends = User.objects.filter(id__in=friend_ids).order_by("username")
        return Response(FriendSerializer(friends, many=True).data)


class UserFriendsListView(APIView):
    """Friends of a user by id."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        friend_ids = set()
        for f in Friendship.objects.filter(user1=user).values_list("user2_id", flat=True):
            friend_ids.add(f)
        for f in Friendship.objects.filter(user2=user).values_list("user1_id", flat=True):
            friend_ids.add(f)
        friends = User.objects.filter(id__in=friend_ids).order_by("username")
        return Response(FriendSerializer(friends, many=True).data)


class ChatMessageListAPI(APIView):
    """Chat history with another user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            other = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        messages = ChatMessage.objects.filter(
            sender__in=[user, other],
            receiver__in=[user, other],
        ).order_by("created_at").select_related("sender", "receiver")
        data = [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "receiver_id": m.receiver_id,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
        return Response(data)


def _display_name(user):
    n = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return n or user.username


class ChatNotificationsListView(APIView):
    """Recent messages you received (for dashboard notifications)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = (
            ChatMessage.objects.filter(receiver=user)
            .select_related("sender")
            .order_by("-created_at")[:60]
        )
        return Response(
            [
                {
                    "id": m.id,
                    "sender_id": m.sender_id,
                    "sender_username": m.sender.username,
                    "sender_display_name": _display_name(m.sender),
                    "content": (m.content or "")[:400],
                    "created_at": m.created_at.isoformat(),
                }
                for m in qs
            ]
        )


class ChatPartnersListView(APIView):
    """People you have chatted with, most recent activity first."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        msgs = (
            ChatMessage.objects.filter(Q(sender=user) | Q(receiver=user))
            .select_related("sender", "receiver")
            .order_by("-created_at")[:400]
        )
        seen = {}
        for m in msgs:
            other = m.sender if m.receiver_id == user.id else m.receiver
            oid = other.id
            if oid not in seen:
                seen[oid] = {
                    "id": other.id,
                    "username": other.username,
                    "display_name": _display_name(other),
                    "last_message_at": m.created_at.isoformat(),
                }
        partners = sorted(seen.values(), key=lambda x: x["last_message_at"], reverse=True)
        return Response(partners)


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        user.delete()
        return Response({'message': 'Account deleted successfully'})    