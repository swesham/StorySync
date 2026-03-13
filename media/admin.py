from django.contrib import admin

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


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "is_private", "created_at")
    search_fields = ("name", "description", "created_by__username")


@admin.register(ClubMember)
class ClubMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "club", "role", "joined_at")
    list_filter = ("role", "club")
    search_fields = ("user__username", "club__name")


@admin.register(ClubShelfItem)
class ClubShelfItemAdmin(admin.ModelAdmin):
    list_display = ("club", "media_type", "media_id", "title", "status", "updated_at")
    list_filter = ("media_type", "status", "club")


@admin.register(ClubPoll)
class ClubPollAdmin(admin.ModelAdmin):
    list_display = ("club", "end_date", "created_by", "created_at")
    list_filter = ("club",)


@admin.register(PollVote)
class PollVoteAdmin(admin.ModelAdmin):
    list_display = ("poll", "user", "choice", "created_at")
    list_filter = ("poll",)


@admin.register(ClubPost)
class ClubPostAdmin(admin.ModelAdmin):
    list_display = ("club", "created_by", "shelf_item", "created_at")
    list_filter = ("club",)


@admin.register(ClubComment)
class ClubCommentAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "created_at")
    list_filter = ("post",)


admin.site.register(BookShelfItem)
admin.site.register(MovieShelfItem)
admin.site.register(PodcastShelfItem)
