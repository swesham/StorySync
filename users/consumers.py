import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


def _room_name(user_id_1, user_id_2):
    a, b = int(user_id_1), int(user_id_2)
    return f"chat_{min(a, b)}_{max(a, b)}"


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope.get("url_route", {}).get("kwargs", {}).get("room_name", "")
        if not self.room_name or "_" not in self.room_name:
            await self.close()
            return
        self.room_group_name = f"chat_{self.room_name}"
        try:
            user = await self._get_user_from_scope()
            if user is None:
                await self.close()
                return
            self.scope["user"] = user
        except Exception:
            await self.close()
            return
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    @database_sync_to_async
    def _get_user_from_scope(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken
        raw = self.scope.get("query_string") or b""
        query = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
        params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
        token = params.get("token", "")
        if not token:
            return None
        try:
            access = AccessToken(token)
            return User.objects.get(pk=access["user_id"])
        except (InvalidToken, User.DoesNotExist, KeyError):
            return None

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            content = (data.get("content") or "").strip()
            other_id = data.get("receiver_id")
            if not content or not other_id:
                return
            user = self.scope.get("user")
            if not user:
                return
            other_id = int(other_id)
            expected = _room_name(user.id, other_id).replace("chat_", "")
            if self.room_name != expected:
                return
            msg = await self._save_message(user.id, other_id, content)
            if msg:
                payload = {
                    "type": "chat_message",
                    "id": msg["id"],
                    "sender_id": msg["sender_id"],
                    "receiver_id": msg["receiver_id"],
                    "content": msg["content"],
                    "created_at": msg["created_at"],
                }
                await self.channel_layer.group_send(self.room_group_name, payload)
                notify_payload = {
                    "type": "chat_notification",
                    "id": msg["id"],
                    "sender_id": msg["sender_id"],
                    "receiver_id": msg["receiver_id"],
                    "content": msg["content"],
                    "created_at": msg["created_at"],
                    "sender_username": msg.get("sender_username", ""),
                    "sender_display_name": msg.get("sender_display_name", ""),
                }
                await self.channel_layer.group_send(f"user_{other_id}_notify", notify_payload)
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    @database_sync_to_async
    def _save_message(self, sender_id, receiver_id, content):
        from .models import ChatMessage
        try:
            sender = User.objects.get(pk=sender_id)
            receiver = User.objects.get(pk=receiver_id)
            msg = ChatMessage.objects.create(sender=sender, receiver=receiver, content=content)
            dn = f"{sender.first_name or ''} {sender.last_name or ''}".strip() or sender.username
            return {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
                "sender_username": sender.username,
                "sender_display_name": dn,
            }
        except User.DoesNotExist:
            return None

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "id": event.get("id"),
            "sender_id": event.get("sender_id"),
            "receiver_id": event.get("receiver_id"),
            "content": event.get("content"),
            "created_at": event.get("created_at"),
        }))


class ChatNotifyConsumer(AsyncWebsocketConsumer):
    """Personal WebSocket for incoming chat (dashboard notification list)."""

    async def connect(self):
        try:
            user = await self._notify_get_user()
            if user is None:
                await self.close()
                return
            self.scope["user"] = user
        except Exception:
            await self.close()
            return
        self.notify_group = f"user_{user.id}_notify"
        await self.channel_layer.group_add(self.notify_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "notify_group"):
            await self.channel_layer.group_discard(self.notify_group, self.channel_name)

    async def receive(self, text_data):
        pass

    @database_sync_to_async
    def _notify_get_user(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken
        raw = self.scope.get("query_string") or b""
        query = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
        params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
        token = params.get("token", "")
        if not token:
            return None
        try:
            access = AccessToken(token)
            return User.objects.get(pk=access["user_id"])
        except (InvalidToken, User.DoesNotExist, KeyError):
            return None

    async def chat_notification(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "id": event.get("id"),
                    "sender_id": event.get("sender_id"),
                    "receiver_id": event.get("receiver_id"),
                    "content": event.get("content"),
                    "created_at": event.get("created_at"),
                    "sender_username": event.get("sender_username", ""),
                    "sender_display_name": event.get("sender_display_name", ""),
                }
            )
        )
