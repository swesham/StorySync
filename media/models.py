from django.conf import settings
from django.db import models


class Club(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="clubs_created",
    )
    is_private = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ClubMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        MEMBER = "MEMBER", "Member"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="club_memberships",
    )
    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "club")
        ordering = ["club", "user"]

    def __str__(self):
        return f"{self.user} in {self.club} ({self.role})"


class ClubShelfItem(models.Model):
    class MediaType(models.TextChoices):
        BOOK = "BOOK", "Book"
        MOVIE = "MOVIE", "Movie"
        PODCAST = "PODCAST", "Podcast"

    class Status(models.TextChoices):
        WANT = "WANT", "Want to consume"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        FINISHED = "FINISHED", "Finished"

    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name="shelf_items",
    )
    media_id = models.CharField(max_length=100)
    media_type = models.CharField(max_length=10, choices=MediaType.choices)
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.WANT,
    )
    title = models.CharField(max_length=300, blank=True)
    image_url = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("club", "media_id", "media_type")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.club} - {self.media_type} - {self.media_id} ({self.status})"


class ClubPoll(models.Model):
    """Admin creates a poll with two media options; closes at end_date."""
    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name="polls",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="club_polls_created",
    )
    end_date = models.DateTimeField()
    # Option 1 (admin can use title-only for "name" polls)
    option1_media_type = models.CharField(max_length=10, choices=ClubShelfItem.MediaType.choices, default="BOOK", blank=True)
    option1_media_id = models.CharField(max_length=100, blank=True, default="")
    option1_title = models.CharField(max_length=300)
    option1_image_url = models.URLField(blank=True)
    # Option 2
    option2_media_type = models.CharField(max_length=10, choices=ClubShelfItem.MediaType.choices, default="BOOK", blank=True)
    option2_media_id = models.CharField(max_length=100, blank=True, default="")
    option2_title = models.CharField(max_length=300)
    option2_image_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Poll in {self.club} until {self.end_date}"

    @property
    def is_closed(self):
        from django.utils import timezone
        return timezone.now() >= self.end_date


class PollVote(models.Model):
    poll = models.ForeignKey(
        ClubPoll,
        on_delete=models.CASCADE,
        related_name="votes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="poll_votes",
    )
    choice = models.PositiveSmallIntegerField()  # 1 or 2
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("poll", "user")
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} voted {self.choice} on poll {self.poll_id}"


class ClubPost(models.Model):
    """Post on club discussion: media (from shelf) + caption. Admin creates/edits."""
    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="club_posts_created",
    )
    caption = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    shelf_item = models.ForeignKey(
        ClubShelfItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posts",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Post in {self.club} ({self.created_at})"


class ClubComment(models.Model):
    """User comment on a club post (discussion)."""
    post = models.ForeignKey(
        ClubPost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="club_comments",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} on post {self.post_id}"


class BookShelfItem(models.Model):
    class ShelfStatus(models.TextChoices):
        WANT_TO_READ = "WANT_TO_READ", "Want to read"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        FINISHED = "FINISHED", "Finished"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="book_shelf_items",
    )
    google_books_id = models.CharField(max_length=100)
    title = models.CharField(max_length=300)
    authors = models.CharField(max_length=500, blank=True)
    thumbnail = models.URLField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=ShelfStatus.choices,
        default=ShelfStatus.WANT_TO_READ,
    )
    progress = models.PositiveIntegerField(default=0)  # 0-100

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "google_books_id")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} - {self.title} ({self.status})"


class MovieShelfItem(models.Model):
    class ShelfStatus(models.TextChoices):
        WANT_TO_WATCH = "WANT_TO_WATCH", "Want to watch"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        FINISHED = "FINISHED", "Finished"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="movie_shelf_items",
    )
    tmdb_id = models.CharField(max_length=100)
    title = models.CharField(max_length=300)
    overview = models.TextField(blank=True)
    poster_url = models.URLField(blank=True)
    release_year = models.PositiveIntegerField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=ShelfStatus.choices,
        default=ShelfStatus.WANT_TO_WATCH,
    )
    progress = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "tmdb_id")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} - {self.title} ({self.status})"


class PodcastShelfItem(models.Model):
    class ShelfStatus(models.TextChoices):
        WANT_TO_LISTEN = "WANT_TO_LISTEN", "Want to listen"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        FINISHED = "FINISHED", "Finished"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="podcast_shelf_items",
    )
    listen_notes_id = models.CharField(max_length=100)
    title = models.CharField(max_length=300)
    publisher = models.CharField(max_length=300, blank=True)
    image = models.URLField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=ShelfStatus.choices,
        default=ShelfStatus.WANT_TO_LISTEN,
    )
    progress = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "listen_notes_id")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} - {self.title} ({self.status})"
