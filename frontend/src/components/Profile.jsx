import { useState, useEffect } from 'react';
import './Profile.css';
import '../inline-message.css';

const API = '/api';

function Profile({ profileUserId, onNavigate, onOpenChat, onViewShelf, onEditPreferences }) {
  // profileUserId null = current user's profile, number = that user's profile
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const [friends, setFriends] = useState([]);
  const [bioEdit, setBioEdit] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bioMessage, setBioMessage] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [friendMessage, setFriendMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');

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
              display_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username,
              bio: data.bio || '',
              profile_picture_url: data.profile_picture_url || null,
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
              bio: data.bio || '',
              profile_picture_url: data.profile_picture_url || null,
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

  useEffect(() => {
    if (!profile) return;
    const url = profile.is_self ? `${API}/profile/me/friends/` : `${API}/profile/${profile.id}/friends/`;
    fetch(url, { headers: auth() })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setFriends(Array.isArray(data) ? data : []))
      .catch(() => setFriends([]));
  }, [profile]);

  useEffect(() => {
    if (profile) setBioEdit(profile.bio || '');
  }, [profile]);

  const handleSaveBio = async () => {
    if (!profile?.is_self || savingBio) return;
    setBioMessage('');
    setSavingBio(true);
    try {
      const res = await fetch(`${API}/profile/update/`, {
        method: 'PATCH',
        headers: json(),
        body: JSON.stringify({ bio: bioEdit }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setProfile((p) => (p ? { ...p, bio: bioEdit } : p));
    } catch (e) {
      setBioMessage(e.message || 'Failed to save');
    } finally {
      setSavingBio(false);
    }
  };

  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.is_self || uploadingPhoto) return;
    setPhotoMessage('');
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('profile_picture', file);
      const res = await fetch(`${API}/profile/update/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const me = await fetch(`${API}/profile/me/`, { headers: auth() });
      if (me.ok) {
        const data = await me.json();
        setProfile((p) => (p ? { ...p, profile_picture_url: data.profile_picture_url || null } : p));
      }
    } catch (err) {
      setPhotoMessage(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleAddFriend = async () => {
    if (!profile || profile.is_self || profile.is_friend || addingFriend) return;
    setFriendMessage('');
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
      setFriendMessage(e.message || 'Failed to add friend');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Are you sure you want to delete your account?');
    if (!confirmed) return;
    setDeleteMessage('');
    try {
      const res = await fetch(`${API}/profile/delete/`, {
        method: 'DELETE',
        headers: auth(),
      });
      if (!res.ok) throw new Error('Failed to delete account');
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      setDeleteMessage(e.message || 'Failed to delete account');
    }
  };

  if (loading) return <div className="profile-page"><p className="profile-loading">Loading...</p></div>;
  if (error) return <div className="profile-page"><p className="profile-error">{error}</p></div>;
  if (!profile) return null;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {profile.profile_picture_url ? (
              <img src={profile.profile_picture_url} alt="Profile" className="profile-avatar-img" onError={(e) => { e.target.style.display = 'none'; const fallback = e.target.nextElementSibling; if (fallback) fallback.style.display = 'block'; }} />
            ) : null}
            <svg className="profile-avatar-fallback" style={{ display: profile.profile_picture_url ? 'none' : 'block' }} viewBox="0 0 24 24" fill="#666" width="48" height="48">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
          {profile.is_self && (
            <>
              <label className="profile-avatar-upload">
                <input type="file" accept="image/*" onChange={handleProfilePhotoChange} disabled={uploadingPhoto} className="profile-avatar-input" />
                {uploadingPhoto ? 'Uploading...' : 'Upload photo'}
              </label>
              {photoMessage ? <p className="inline-form-msg">{photoMessage}</p> : null}
            </>
          )}
        </div>
        <h1 className="profile-name">{profile.display_name || profile.username}</h1>
        <p className="profile-username">@{profile.username}</p>
        {profile.email && <p className="profile-email">{profile.email}</p>}
        {profile.is_self && <p className="profile-badge">Your profile</p>}
        <div className="profile-bio-section">
          {profile.is_self ? (
            <>
              <label className="profile-label">Bio</label>
              <textarea
                className="profile-bio-input"
                value={bioEdit}
                onChange={(e) => { setBioEdit(e.target.value); setBioMessage(''); }}
                placeholder="Write something about yourself..."
                rows={3}
              />
              <button type="button" className="profile-save-bio" onClick={handleSaveBio} disabled={savingBio}>
                {savingBio ? 'Saving...' : 'Save bio'}
              </button>
              {bioMessage ? <p className="inline-form-msg">{bioMessage}</p> : null}
              <br></br>
              <button type="button" className="profile-delete-btn" onClick={handleDeleteAccount}>
                Delete Account
              </button>
              {deleteMessage ? <p className="inline-form-msg">{deleteMessage}</p> : null}
              <br></br>
              {onEditPreferences && (
                <button type="button" className="profile-edit-prefs-btn" onClick={onEditPreferences}>
                  Edit Preferences
                </button>
              )}
            </>
          ) : (
            <>
              {profile.bio ? <p className="profile-bio">{profile.bio}</p> : null}
              <div className="profile-friend-section">
                {profile.is_friend ? (
                  <p className="profile-badge profile-friends">Friends</p>
                ) : (
                  <>
                    <button
                      type="button"
                      className="profile-add-friend"
                      onClick={handleAddFriend}
                      disabled={addingFriend}
                    >
                      {addingFriend ? 'Adding...' : 'Add friend'}
                    </button>
                    {friendMessage ? <p className="inline-form-msg">{friendMessage}</p> : null}
                  </>
                )}
                {onOpenChat && (
                  <button type="button" className="profile-message-btn" onClick={() => onOpenChat(profile.id, profile.display_name || profile.username)}>
                    Message
                  </button>
                )}
                {onViewShelf && (
                  <button type="button" className="profile-view-shelf" onClick={() => onViewShelf(profile.id, profile.display_name || profile.username)}>
                    View Shelf
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="profile-friends-list">
          <h3 className="profile-friends-title">Friends ({friends.length})</h3>
          {friends.length === 0 ? (
            <p className="profile-friends-empty">No friends yet.</p>
          ) : (
            <ul className="profile-friends-ul">
              {friends.map((f) => (
                <li key={f.id}>{f.display_name || f.username}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button type="button" className="profile-back" onClick={() => onNavigate()}>
        Back
      </button>
    </div>
  );
}

export default Profile;
