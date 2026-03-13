from rest_framework import serializers

from .models import (
    BookShelfItem,
    MovieShelfItem,
    PodcastShelfItem,
    Club,
    ClubShelfItem,
    ClubPoll,
    PollVote,
    ClubPost,
    ClubComment,
)


class ClubSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    current_user_role = serializers.SerializerMethodField()

    class Meta:
        model = Club
        fields = [
            "id",
            "name",
            "description",
            "created_by",
            "is_private",
            "current_user_role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def get_current_user_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        # Django staff/superuser can manage any club
        if getattr(request.user, "is_staff", False) or getattr(request.user, "is_superuser", False):
            return "ADMIN"
        from .models import ClubMember
        m = ClubMember.objects.filter(club=obj, user=request.user).first()
        return m.role if m else None


class BookShelfItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookShelfItem
        fields = [
            "id",
            "google_books_id",
            "title",
            "authors",
            "thumbnail",
            "status",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MovieShelfItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovieShelfItem
        fields = [
            "id",
            "tmdb_id",
            "title",
            "overview",
            "poster_url",
            "release_year",
            "status",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PodcastShelfItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PodcastShelfItem
        fields = [
            "id",
            "listen_notes_id",
            "title",
            "publisher",
            "image",
            "status",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ClubShelfItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClubShelfItem
        fields = [
            "id",
            "club",
            "media_id",
            "media_type",
            "status",
            "title",
            "image_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "club", "created_at", "updated_at"]


class ClubPollSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    is_closed = serializers.BooleanField(read_only=True)
    vote_count_1 = serializers.SerializerMethodField()
    vote_count_2 = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = ClubPoll
        fields = [
            "id",
            "club",
            "created_by",
            "end_date",
            "option1_media_type",
            "option1_media_id",
            "option1_title",
            "option1_image_url",
            "option2_media_type",
            "option2_media_id",
            "option2_title",
            "option2_image_url",
            "is_closed",
            "vote_count_1",
            "vote_count_2",
            "user_vote",
            "created_at",
        ]
        read_only_fields = ["id", "club", "created_by", "created_at"]
        extra_kwargs = {
            "option1_media_type": {"required": False, "allow_blank": True},
            "option1_media_id": {"required": False, "allow_blank": True},
            "option1_image_url": {"required": False, "allow_blank": True},
            "option2_media_type": {"required": False, "allow_blank": True},
            "option2_media_id": {"required": False, "allow_blank": True},
            "option2_image_url": {"required": False, "allow_blank": True},
        }

    def get_vote_count_1(self, obj):
        return obj.votes.filter(choice=1).count()

    def get_vote_count_2(self, obj):
        return obj.votes.filter(choice=2).count()

    def get_user_vote(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        vote = obj.votes.filter(user=request.user).first()
        return vote.choice if vote else None


class PollVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollVote
        fields = ["id", "poll", "user", "choice", "created_at"]
        read_only_fields = ["id", "poll", "user", "created_at"]


class ClubPostSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    shelf_item = ClubShelfItemSerializer(read_only=True)

    class Meta:
        model = ClubPost
        fields = [
            "id",
            "club",
            "created_by",
            "caption",
            "image_url",
            "shelf_item",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "club", "created_by", "created_at", "updated_at"]


class ClubPostWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClubPost
        fields = ["id", "club", "caption", "image_url", "shelf_item", "created_at", "updated_at"]
        read_only_fields = ["id", "club", "created_by", "created_at", "updated_at"]


class ClubCommentSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source="user.username", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = ClubComment
        fields = ["id", "post", "user", "user_id", "text", "created_at"]
        read_only_fields = ["id", "post", "user", "user_id", "created_at"]

