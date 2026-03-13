import { useState, useEffect } from 'react';
import './Profile.css';

const API = '/api';

function Profile({ profileUserId, onNavigate }) {
  // profileUserId null = current user's profile, number = that user's profile
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingFriend, setAddingFriend] = useState(false);

  const token = () => localStorage.getItem('access_token');
  const auth = () => ({ Authorization: `Bearer ${token()}` });
  const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = profileUserId
      ? `${API}/profile/${profileUserId}/`
      : `${API}/profile/me/`;
    fetch(url, { headers: auth() })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          if (profileUserId) {
            setProfile({
              id: data.id,
              username: data.username,
              email: data.email || '',
              display_name: data.display_name || data.username,
              is_self: data.is_self,
              is_friend: data.is_friend,
            });
          } else {
            setProfile({
              id: data.id,
              username: data.username,
              email: data.email || '',
              display_name: data.first_name && data.last_name
                ? `${data.first_name} ${data.last_name}`.trim()
                : (data.first_name || data.last_name || data.username),
              is_self: true,
              is_friend: true,
            });
          }
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profileUserId]);

  const handleAddFriend = async () => {
    if (!profile || profile.is_self || profile.is_friend || addingFriend) return;
    setAddingFriend(true);
    try {
      const res = await fetch(`${API}/profile/${profile.id}/add-friend/`, {
        method: 'POST',
        headers: json(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add friend');
      }
      setProfile((p) => ({ ...p, is_friend: true }));
    } catch (e) {
      alert(e.message);
    } finally {
      setAddingFriend(false);
    }
  };

  if (loading) return <div className="profile-page"><p className="profile-loading">Loading...</p></div>;
  if (error) return <div className="profile-page"><p className="profile-error">{error}</p></div>;
  if (!profile) return null;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">
          <svg viewBox="0 0 24 24" fill="#666" width="48" height="48">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
        <h1 className="profile-name">{profile.display_name || profile.username}</h1>
        <p className="profile-username">@{profile.username}</p>
        {profile.email && <p className="profile-email">{profile.email}</p>}
        {profile.is_self ? (
          <p className="profile-badge">Your profile</p>
        ) : (
          <div className="profile-friend-section">
            {profile.is_friend ? (
              <p className="profile-badge profile-friends">Friends</p>
            ) : (
              <button
                type="button"
                className="profile-add-friend"
                onClick={handleAddFriend}
                disabled={addingFriend}
              >
                {addingFriend ? 'Adding...' : 'Add friend'}
              </button>
            )}
          </div>
        )}
      </div>
      <button type="button" className="profile-back" onClick={() => onNavigate()}>
        Back
      </button>
    </div>
  );
}

export default Profile;
