import { useState, useEffect, useRef } from 'react';
import './Chat.css';

const API = '/api';
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname || 'localhost'}:8000`;

function Chat({ otherUserId, otherDisplayName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState(null);
  const listRef = useRef(null);

  const token = () => localStorage.getItem('access_token');
  const auth = () => ({ Authorization: `Bearer ${token()}` });
  const myId = () => {
    try {
      const t = token();
      if (!t) return null;
      const payload = JSON.parse(atob(t.split('.')[1]));
      const id = payload.user_id ?? payload.sub;
      return id != null ? parseInt(id, 10) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!otherUserId) return;
    fetch(`${API}/chat/${otherUserId}/messages/`, { headers: auth() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [otherUserId]);

  useEffect(() => {
    if (!otherUserId || !token()) return;
    const a = myId();
    const b = parseInt(otherUserId, 10);
    if (!a || !b) return;
    const room = a < b ? `${a}_${b}` : `${b}_${a}`;
    const url = `${WS_BASE}/ws/chat/${room}/?token=${encodeURIComponent(token())}`;
    const socket = new WebSocket(url);
    socket.onopen = () => setWs(socket);
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setMessages((prev) => [...prev, { id: msg.id, sender_id: msg.sender_id, receiver_id: msg.receiver_id, content: msg.content, created_at: msg.created_at }]);
      } catch {}
    };
    socket.onclose = () => setWs(null);
    socket.onerror = () => {}
    return () => {
      socket.close();
      setWs(null);
    };
  }, [otherUserId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    const text = (input || '').trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ content: text, receiver_id: parseInt(otherUserId, 10) }));
    setInput('');
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h2 className="chat-title">{otherDisplayName || 'Chat'}</h2>
        <button type="button" className="chat-close" onClick={onClose}>Back</button>
      </div>
      <div className="chat-messages" ref={listRef}>
        {loading ? (
          <p className="chat-loading">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.sender_id === myId() ? 'chat-msg chat-msg-mine' : 'chat-msg chat-msg-theirs'}>
              <span className="chat-msg-text">{m.content}</span>
              <span className="chat-msg-time">{m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}</span>
            </div>
          ))
        )}
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          disabled={!ws || ws.readyState !== WebSocket.OPEN}
        />
        <button type="button" className="chat-send" onClick={send} disabled={!input.trim() || !ws || ws.readyState !== WebSocket.OPEN}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;
