import { useState, useEffect, useCallback } from 'react';
import './DashboardChatBlocks.css';

const API = '/api';
const PAGE_SIZE = 4;
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname || 'localhost'}:8000`;

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

export function DashboardChatNotifications({ onOpenProfile }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);

  const fetchList = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setItems([]);
      return;
    }
    fetch(`${API}/chat/notifications/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return undefined;
    const url = `${WS_BASE}/ws/chat/notify/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.id == null || data.sender_id == null) return;
        setItems((prev) => {
          const rest = prev.filter((x) => x.id !== data.id);
          const row = {
            id: data.id,
            sender_id: data.sender_id,
            sender_username: data.sender_username || '',
            sender_display_name: data.sender_display_name || data.sender_username || 'Someone',
            content: (data.content || '').slice(0, 400),
            created_at: data.created_at,
          };
          return [row, ...rest].slice(0, 80);
        });
        window.dispatchEvent(new CustomEvent('chatPartnerActivity'));
      } catch {
        /* ignore */
      }
    };
    return () => socket.close();
  }, []);

  const visible = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasMore = (page + 1) * PAGE_SIZE < items.length;

  return (
    <div className="db-section">
      <span className="db-section-label">Chat notifications</span>
      <div className="db-friends-area">
        {items.length === 0 ? (
          <p className="db-hint">No messages yet.</p>
        ) : (
          <>
            <ul className="db-friends-list">
              {visible.map((n) => (
                <li key={n.id} className="db-friends-item db-chat-notif-item">
                  <div className="db-chat-notif-main">
                    <span
                      className="db-friends-name"
                      onClick={() => onOpenProfile?.(n.sender_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onOpenProfile?.(n.sender_id)}
                    >
                      {n.sender_display_name || n.sender_username || 'User'}
                    </span>
                    <p className="db-chat-notif-preview">{n.content || '—'}</p>
                    <span className="db-chat-notif-time">{formatTime(n.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {(hasMore || page > 0) && (
              <div className="db-next-row">
                {page > 0 && (
                  <span className="db-next-link" onClick={() => setPage((p) => p - 1)} role="button" tabIndex={0}>
                    ‹ Prev
                  </span>
                )}
                {hasMore && (
                  <span className="db-next-link" onClick={() => setPage((p) => p + 1)} role="button" tabIndex={0}>
                    Next ›
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function DashboardContinueChatting({ onOpenProfile, onOpenChat }) {
  const [partners, setPartners] = useState([]);
  const [page, setPage] = useState(0);

  const fetchPartners = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setPartners([]);
      return;
    }
    fetch(`${API}/chat/partners/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPartners(Array.isArray(data) ? data : []))
      .catch(() => setPartners([]));
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  useEffect(() => {
    const onActivity = () => fetchPartners();
    window.addEventListener('chatPartnerActivity', onActivity);
    return () => window.removeEventListener('chatPartnerActivity', onActivity);
  }, [fetchPartners]);

  const visible = partners.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasMore = (page + 1) * PAGE_SIZE < partners.length;

  return (
    <div className="db-section">
      <span className="db-section-label">Continue chatting</span>
      <div className="db-friends-area">
        {partners.length === 0 ? (
          <p className="db-hint">No conversations yet.</p>
        ) : (
          <>
            <ul className="db-friends-list">
              {visible.map((p) => (
                <li key={p.id} className="db-friends-item">
                  <span
                    className="db-friends-name"
                    onClick={() => onOpenProfile?.(p.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenProfile?.(p.id)}
                  >
                    {p.display_name || p.username}
                  </span>
                  {onOpenChat && (
                    <button
                      type="button"
                      className="db-friends-msg-btn"
                      onClick={() => onOpenChat(p.id, p.display_name || p.username)}
                    >
                      Message
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {(hasMore || page > 0) && (
              <div className="db-next-row">
                {page > 0 && (
                  <span className="db-next-link" onClick={() => setPage((x) => x - 1)} role="button" tabIndex={0}>
                    ‹ Prev
                  </span>
                )}
                {hasMore && (
                  <span className="db-next-link" onClick={() => setPage((x) => x + 1)} role="button" tabIndex={0}>
                    Next ›
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
