from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
   
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'password2', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True}
        }

    def validate_email(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("This field may not be blank.")
        if User.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return v

    def validate_username(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("This field may not be blank.")
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return v
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        first = (attrs.get("first_name") or "").strip()
        last = (attrs.get("last_name") or "").strip()
        if not first or not last:
            raise serializers.ValidationError({
                "full_name": "Please provide both first and last name."
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'bio', 'profile_picture', 'profile_picture_url', 'interests', 'created_at',
            'is_staff', 'is_superuser'
        ]
        read_only_fields = ['id', 'username', 'created_at', 'is_staff', 'is_superuser']

    def get_profile_picture_url(self, obj):
        if not obj.profile_picture:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_picture.url)
        return obj.profile_picture.url


class PublicProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'display_name', 'bio', 'profile_picture_url']
        read_only_fields = fields

    def get_display_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return obj.username

    def get_profile_picture_url(self, obj):
        if not obj.profile_picture:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_picture.url)
        return obj.profile_picture.url


class FriendSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'display_name']

    def get_display_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return obj.username


class UserUpdateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'bio', 'profile_picture', 'interests']