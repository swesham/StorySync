from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    email = models.EmailField("email address", unique=True, blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True, null=True)
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        blank=True,
        null=True
    )

    interests = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.username


class Friendship(models.Model):
    user1 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="friendship_as_user1",
    )
    user2 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="friendship_as_user2",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user1", "user2"],
                name="unique_friendship",
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user1.username} & {self.user2.username}"


class ChatMessage(models.Model):
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_messages_sent",
    )
    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_messages_received",
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender_id} -> {self.receiver_id}: {self.content[:20]}"