import { useState, useEffect, useCallback } from 'react';
import './ClubDiscussion.css';
import '../inline-message.css';

const API = '/api/media';

const BACKEND_HELP = 'Is the Django backend running?';

function safeJson(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) {
    throw new Error(BACKEND_HELP);
  }
  return res.text().then((text) => {
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(BACKEND_HELP);
    }
  });
}

function ClubDiscussion({ clubId, onNavigate, onOpenProfile, onViewClubShelf, isAppAdmin, backToView }) {
  const [club, setClub] = useState(null);
  const [posts, setPosts] = useState([]);
  const [polls, setPolls] = useState([]);
  const [shelf, setShelf] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAddPost, setShowAddPost] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState(null);
  const [postForm, setPostForm] = useState({ caption: '', image_url: '' });
  const [postImageUploading, setPostImageUploading] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollForm, setPollForm] = useState({
    option1_title: '',
    option2_title: '',
    end_date: '',
  });
  const [commentText, setCommentText] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [postModalMessage, setPostModalMessage] = useState('');
  const [pollModalMessage, setPollModalMessage] = useState('');

  const token = () => localStorage.getItem('access_token');
  const auth = () => ({ Authorization: `Bearer ${token()}` });
  const json = () => ({ ...auth(), 'Content-Type': 'application/json' });

  const mainPost = posts[0] || null;
  const mainPostId = mainPost?.id;
  const activePoll = polls.find(p => !p.is_closed) || polls[0] || null;
  const isClubAdmin = club?.current_user_role === 'ADMIN' || !!isAppAdmin;

  const fetchClub = useCallback(async () => {
    const res = await fetch(`${API}/clubs/${clubId}/`, { headers: auth() });
    if (!res.ok) throw new Error('Club not found');
    return safeJson(res);
  }, [clubId]);

  const fetchPosts = useCallback(async () => {
    const res = await fetch(`${API}/clubs/${clubId}/posts/`, { headers: auth() });
    if (!res.ok) return [];
    return safeJson(res).then((data) => Array.isArray(data) ? data : []);
  }, [clubId]);

  const fetchPolls = useCallback(async () => {
    const res = await fetch(`${API}/clubs/${clubId}/polls/`, { headers: auth() });
    if (!res.ok) return [];
    return safeJson(res).then((data) => Array.isArray(data) ? data : []);
  }, [clubId]);

  const fetchShelf = useCallback(async () => {
    const res = await fetch(`${API}/clubs/${clubId}/shelf/`, { headers: auth() });
    if (!res.ok) return [];
    return safeJson(res).then((data) => Array.isArray(data) ? data : []);
  }, [clubId]);

  const fetchComments = useCallback(async (postId) => {
    if (!postId) return [];
    const res = await fetch(`${API}/clubs/${clubId}/posts/${postId}/comments/`, { headers: auth() });
    if (!res.ok) return [];
    return safeJson(res).then((data) => Array.isArray(data) ? data : []);
  }, [clubId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clubData, postsData, pollsData, shelfData] = await Promise.all([
        fetchClub(),
        fetchPosts(),
        fetchPolls(),
        fetchShelf(),
      ]);
      setClub(clubData);
      setPosts(postsData);
      setPolls(pollsData);
      setShelf(shelfData);
      if (postsData.length > 0) {
        const commentsData = await fetchComments(postsData[0].id);
        setComments(commentsData);
      } else {
        setComments([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchClub, fetchPosts, fetchPolls, fetchShelf, fetchComments]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const fetchCloudinaryConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API}/cloudinary-config/`, { headers: auth() });
      if (res.ok) {
        const data = await safeJson(res);
        if (data?.cloud_name) setCloudinaryConfig(data);
      }
    } catch {
      setCloudinaryConfig(null);
    }
  }, []);

  useEffect(() => {
    if (mainPostId) {
      fetchComments(mainPostId).then(setComments);
    } else {
      setComments([]);
    }
  }, [mainPostId, fetchComments]);

  useEffect(() => {
    if (showAddPost && !cloudinaryConfig) fetchCloudinaryConfig();
  }, [showAddPost, cloudinaryConfig, fetchCloudinaryConfig]);

  const uploadImageToCloudinary = async (file) => {
    if (!cloudinaryConfig?.cloud_name || !cloudinaryConfig?.upload_preset) {
      setPostModalMessage('Image upload not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in your Django .env');
      return;
    }
    setPostModalMessage('');
    setPostImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.upload_preset);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/image/upload`,
        { method: 'POST', body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Upload failed');
      }
      const data = await res.json();
      const url = data.secure_url;
      if (url) setPostForm((f) => ({ ...f, image_url: url }));
    } catch (e) {
      setPostModalMessage(e.message || 'Image upload failed');
    } finally {
      setPostImageUploading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setPostModalMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/posts/`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({
          caption: postForm.caption,
          image_url: postForm.image_url || null,
        }),
      });
      if (!res.ok) {
        const err = await safeJson(res).catch(() => ({}));
        throw new Error(err.caption?.[0] || err.detail || 'Failed to create post');
      }
      setPostModalMessage('');
      setShowAddPost(false);
      setPostForm({ caption: '', image_url: '' });
      const postsData = await fetchPosts();
      setPosts(postsData);
    } catch (e) {
      setPostModalMessage(e.message || 'Failed to create post');
    }
  };

  const handleUpdatePost = async (postId, caption, shelfItemId) => {
    setPageMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/posts/${postId}/`, {
        method: 'PATCH',
        headers: json(),
        body: JSON.stringify({
          caption: caption ?? mainPost?.caption,
          shelf_item: shelfItemId !== undefined ? shelfItemId : mainPost?.shelf_item?.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to update post');
      const postsData = await fetchPosts();
      setPosts(postsData);
    } catch (e) {
      setPageMessage(e.message || 'Failed to update post');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this post?')) return;
    setPageMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/posts/${postId}/`, {
        method: 'DELETE',
        headers: auth(),
      });
      if (!res.ok) throw new Error('Failed to delete post');
      const postsData = await fetchPosts();
      setPosts(postsData);
      setComments([]);
    } catch (e) {
      setPageMessage(e.message || 'Failed to delete post');
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const t1 = (pollForm.option1_title || '').trim();
    const t2 = (pollForm.option2_title || '').trim();
    if (!t1 || !t2 || !pollForm.end_date) {
      setPollModalMessage('Enter names for both options and set an end date.');
      return;
    }
    setPollModalMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/polls/`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({
          end_date: new Date(pollForm.end_date).toISOString(),
          option1_title: t1,
          option2_title: t2,
        }),
      });
      if (!res.ok) {
        const err = await safeJson(res).catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || 'Failed to create poll');
      }
      setShowCreatePoll(false);
      setPollForm({ option1_title: '', option2_title: '', end_date: '' });
      const pollsData = await fetchPolls();
      setPolls(pollsData);
    } catch (e) {
      setPollModalMessage(e.message || 'Failed to create poll');
    }
  };

  const handleVote = async (pollId, choice) => {
    setPageMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/polls/${pollId}/vote/`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({ choice: Number(choice) }),
      });
      if (!res.ok) {
        const err = await safeJson(res).catch(() => ({}));
        throw new Error(err.error || err.detail || 'Failed to vote');
      }
      const pollsData = await fetchPolls();
      setPolls(Array.isArray(pollsData) ? pollsData : []);
    } catch (e) {
      setPageMessage(e.message || 'Failed to vote');
    }
  };

  const handleAddWinningToShelf = async () => {
    if (!activePoll || !activePoll.is_closed) return;
    const c1 = activePoll.vote_count_1 ?? 0;
    const c2 = activePoll.vote_count_2 ?? 0;
    const winner = c1 >= c2 ? 1 : 2;
    const mediaId = winner === 1 ? activePoll.option1_media_id : activePoll.option2_media_id;
    if (!mediaId) {
      setPageMessage('This poll was created with names only; winning media cannot be added to shelf.');
      return;
    }
    setPageMessage('');
    const mediaType = winner === 1 ? activePoll.option1_media_type : activePoll.option2_media_type;
    const title = winner === 1 ? activePoll.option1_title : activePoll.option2_title;
    const imageUrl = winner === 1 ? activePoll.option1_image_url : activePoll.option2_image_url;
    try {
      const res = await fetch(`${API}/clubs/${clubId}/shelf/`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({
          media_type: mediaType,
          media_id: mediaId,
          title: title || '',
          image_url: imageUrl || '',
        }),
      });
      if (!res.ok) {
        const err = await safeJson(res).catch(() => ({}));
        throw new Error(err.detail || err.media_id?.[0] || 'Failed to add to shelf');
      }
      const shelfData = await fetchShelf();
      setShelf(shelfData);
    } catch (e) {
      setPageMessage(e.message || 'Failed to add to shelf');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !mainPostId) return;
    setPageMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/posts/${mainPostId}/comments/`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      setCommentText('');
      const commentsData = await fetchComments(mainPostId);
      setComments(commentsData);
    } catch (e) {
      setPageMessage(e.message || 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    setPageMessage('');
    try {
      const res = await fetch(
        `${API}/clubs/${clubId}/posts/${mainPostId}/comments/${commentId}/`,
        { method: 'DELETE', headers: auth() }
      );
      if (!res.ok) throw new Error('Failed to delete comment');
      const commentsData = await fetchComments(mainPostId);
      setComments(commentsData);
    } catch (e) {
      setPageMessage(e.message || 'Failed to delete comment');
    }
  };

  const handleDeleteClub = async () => {
    if (!confirm('Delete this club and everything in it (posts, polls, shelf, comments)? This cannot be undone.')) return;
    setPageMessage('');
    try {
      const res = await fetch(`${API}/clubs/${clubId}/`, { method: 'DELETE', headers: auth() });
      if (!res.ok) {
        const err = await safeJson(res).catch(() => ({}));
        throw new Error(err.detail || err.error || 'Failed to delete club');
      }
      onNavigate(backToView || 'userdashboard');
    } catch (e) {
      setPageMessage(e.message || 'Failed to delete club');
    }
  };

  const winningHasMediaId = activePoll?.is_closed && (() => {
    const w = activePoll.vote_count_1 >= activePoll.vote_count_2 ? 1 : 2;
    const id = w === 1 ? activePoll.option1_media_id : activePoll.option2_media_id;
    return !!id;
  })();

  if (loading) return <div className="cd-root"><p className="cd-loading">Loading...</p></div>;
  if (error) return <div className="cd-root"><p className="cd-error">{error}</p><button type="button" className="cd-btn cd-btn-primary" onClick={() => onNavigate(backToView || 'userdashboard')}>Back</button></div>;
  if (!club) return <div className="cd-root"><p className="cd-error">Club not found.</p><button type="button" className="cd-btn cd-btn-primary" onClick={() => onNavigate(backToView || 'userdashboard')}>Back</button></div>;

  const shelfItemImage = (item) => item?.image_url || item?.thumbnail || item?.poster_url || null;

  return (
    <div className="cd-root">
      <div className="cd-header">
        <button type="button" className="cd-back" onClick={() => onNavigate(backToView || 'userdashboard')}>← Back</button>
        <h1 className="cd-title">{club.name}</h1>
      </div>

      <div className="cd-main">
        <div className="cd-left">
          <div className="cd-media-block">
            {mainPost?.image_url ? (
              <img
                src={mainPost.image_url}
                alt="Post"
                className="cd-media-img"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : mainPost?.shelf_item ? (
              <img
                src={shelfItemImage(mainPost.shelf_item)}
                alt={mainPost.shelf_item?.title}
                className="cd-media-img"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="cd-media-placeholder">No media</div>
            )}
          </div>
          <div className="cd-actions">
            {onViewClubShelf && (
              <button
                type="button"
                className="cd-btn cd-btn-add cd-btn-view-shelf"
                onClick={() => onViewClubShelf(clubId)}
              >
                View shelf
              </button>
            )}
            {isClubAdmin && (
              <>
                <button type="button" className="cd-btn cd-btn-add" onClick={() => { setPostModalMessage(''); setShowAddPost(true); }}>Add Post</button>
                {mainPost && (
                  <>
                    <button type="button" className="cd-link" onClick={() => {
                      const c = prompt('Caption', mainPost.caption);
                      if (c != null) handleUpdatePost(mainPost.id, c, mainPost.shelf_item?.id);
                    }}>Edit</button>
                    <button type="button" className="cd-link" onClick={() => handleDeletePost(mainPost.id)}>Delete</button>
                  </>
                )}
              </>
            )}
          </div>
          <div className="cd-caption">
            <span className="cd-caption-label">Caption</span>
            <p className="cd-caption-text">{mainPost?.caption || '—'}</p>
          </div>
        </div>

        <div className="cd-right">
          <section className="cd-poll-section">
            <h3 className="cd-section-title">Poll</h3>
            {activePoll ? (
              <div className="cd-poll-box">
                <p className="cd-poll-meta">
                  Closes {new Date(activePoll.end_date).toLocaleString()}
                  {activePoll.is_closed && ' (Closed)'}
                </p>
                <div className="cd-poll-options">
                  <div className="cd-poll-opt">
                    <img src={activePoll.option1_image_url} alt="" className="cd-poll-thumb" onError={(e) => e.target.style.display = 'none'} />
                    <span>{activePoll.option1_title}</span>
                    <span className="cd-poll-votes">
                      {activePoll.is_closed
                        ? `${activePoll.percentage_1 ?? 0}% (${activePoll.vote_count_1} votes)`
                        : `${activePoll.vote_count_1} votes`}
                    </span>
                    {!activePoll.is_closed && (
                      <button type="button" className="cd-vote-btn" onClick={() => handleVote(activePoll.id, 1)}>Vote</button>
                    )}
                  </div>
                  <div className="cd-poll-opt">
                    <img src={activePoll.option2_image_url} alt="" className="cd-poll-thumb" onError={(e) => e.target.style.display = 'none'} />
                    <span>{activePoll.option2_title}</span>
                    <span className="cd-poll-votes">
                      {activePoll.is_closed
                        ? `${activePoll.percentage_2 ?? 0}% (${activePoll.vote_count_2} votes)`
                        : `${activePoll.vote_count_2} votes`}
                    </span>
                    {!activePoll.is_closed && (
                      <button type="button" className="cd-vote-btn" onClick={() => handleVote(activePoll.id, 2)}>Vote</button>
                    )}
                  </div>
                </div>
                {activePoll.is_closed && isClubAdmin && winningHasMediaId && (
                  <button type="button" className="cd-btn cd-btn-primary" onClick={handleAddWinningToShelf}>
                    Add winning media to club shelf
                  </button>
                )}
              </div>
            ) : (
              <p className="cd-hint">No poll yet.</p>
            )}
            {isClubAdmin && (
              <button type="button" className="cd-btn cd-btn-secondary" onClick={() => { setPollModalMessage(''); setShowCreatePoll(true); }}>Create poll</button>
            )}
          </section>
        </div>
      </div>

      {pageMessage ? <p className="inline-form-msg cd-page-msg">{pageMessage}</p> : null}

      <section className="cd-discussion">
        <h3 className="cd-section-title">Discussion</h3>
        {(club.description || '').trim() ? (
          <p className="cd-discussion-club-caption">{(club.description || '').trim()}</p>
        ) : null}
        {mainPostId ? (
          <>
            <ul className="cd-comment-list">
              {comments.length === 0 && <li className="cd-hint">No comments yet.</li>}
              {comments.map((c) => (
                <li key={c.id} className="cd-comment">
                  {onOpenProfile && c.user_id ? (
                    <button type="button" className="cd-comment-user cd-comment-user-link" onClick={() => onOpenProfile(c.user_id)}>{c.user}</button>
                  ) : (
                    <span className="cd-comment-user">{c.user}</span>
                  )}
                  <span className="cd-comment-text">{c.text}</span>
                  <span className="cd-comment-date">{new Date(c.created_at).toLocaleString()}</span>
                  {isClubAdmin && (
                    <button type="button" className="cd-link cd-comment-delete" onClick={() => handleDeleteComment(c.id)}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddComment} className="cd-comment-form">
              <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." rows={2} className="cd-input" />
              <button type="submit" className="cd-btn cd-btn-primary">Post comment</button>
            </form>
          </>
        ) : (
          <p className="cd-hint">Add a post above to start the discussion.</p>
        )}
        {isClubAdmin && (
          <button type="button" className="cd-delete-club-btn" onClick={handleDeleteClub}>
            Delete club
          </button>
        )}
      </section>

      {showAddPost && (
        <div className="cd-modal-overlay" onClick={() => { setShowAddPost(false); setPostModalMessage(''); }}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <h3>Add Post</h3>
            <form onSubmit={handleCreatePost}>
              <label>Photo (optional)</label>
              <div className="cd-upload-row">
                <input
                  type="file"
                  accept="image/*"
                  className="cd-input-file"
                  disabled={postImageUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImageToCloudinary(file);
                    e.target.value = '';
                  }}
                />
                {postImageUploading && <span className="cd-hint">Uploading…</span>}
                {postForm.image_url && !postImageUploading && (
                  <span className="cd-hint">Image added. <button type="button" className="cd-link" onClick={() => setPostForm(f => ({ ...f, image_url: '' }))}>Remove</button></span>
                )}
              </div>
              {!cloudinaryConfig?.upload_preset && !postImageUploading && (
                <p className="cd-hint">Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in Django .env to enable photo upload.</p>
              )}
              {postForm.image_url && (
                <img src={postForm.image_url} alt="Preview" className="cd-preview-img" />
              )}
              <label>Caption</label>
              <textarea placeholder="Caption" value={postForm.caption} onChange={e => setPostForm(f => ({ ...f, caption: e.target.value }))} rows={3} className="cd-input" />
              <div className="cd-modal-actions">
                <button type="button" onClick={() => { setShowAddPost(false); setPostModalMessage(''); }}>Cancel</button>
                <button type="submit">Create</button>
              </div>
              {postModalMessage ? <p className="inline-form-msg">{postModalMessage}</p> : null}
            </form>
          </div>
        </div>
      )}

      {showCreatePoll && (
        <div className="cd-modal-overlay" onClick={() => { setShowCreatePoll(false); setPollModalMessage(''); }}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <h3>Create poll</h3>
            <p className="cd-hint">Enter the names of the two options. Members will vote on them.</p>
            <form onSubmit={handleCreatePoll}>
              <label>Option 1 name</label>
              <input
                type="text"
                placeholder="e.g. Harry Potter and the Sorcerer's Stone"
                value={pollForm.option1_title}
                onChange={e => setPollForm(f => ({ ...f, option1_title: e.target.value }))}
                className="cd-input"
                required
              />
              <label>Option 2 name</label>
              <input
                type="text"
                placeholder="e.g. The Lord of the Rings"
                value={pollForm.option2_title}
                onChange={e => setPollForm(f => ({ ...f, option2_title: e.target.value }))}
                className="cd-input"
                required
              />
              <label>End date</label>
              <input type="datetime-local" value={pollForm.end_date} onChange={e => setPollForm(f => ({ ...f, end_date: e.target.value }))} className="cd-input" required />
              <div className="cd-modal-actions">
                <button type="button" onClick={() => { setShowCreatePoll(false); setPollModalMessage(''); }}>Cancel</button>
                <button type="submit">Create poll</button>
              </div>
              {pollModalMessage ? <p className="inline-form-msg">{pollModalMessage}</p> : null}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubDiscussion;
