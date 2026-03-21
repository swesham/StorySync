import { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import MyShelf from './components/MyShelf';
import SearchFilter from './components/SearchFilter';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ClubDiscussion from './components/ClubDiscussion';
import Profile from './components/Profile';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [clubDiscussionId, setClubDiscussionId] = useState(null);
  const [profileUserId, setProfileUserId] = useState(null);
  const [viewShelfUserId, setViewShelfUserId] = useState(null);
  const [viewShelfDisplayName, setViewShelfDisplayName] = useState('');
  const [chatWithUserId, setChatWithUserId] = useState(null);
  const [chatWithDisplayName, setChatWithDisplayName] = useState('');
  const [currentView, setCurrentView] = useState(() => {
    const token = localStorage.getItem('access_token');
    const fromLogin = sessionStorage.getItem('from_login');
    if (fromLogin && token) {
      sessionStorage.removeItem('from_login');
      return sessionStorage.getItem('is_admin') === 'true' ? 'dashboard' : 'userdashboard';
    }
    return 'landing';
  });
  const isAdmin = sessionStorage.getItem('is_admin') === 'true';

  const isLoggedIn = !!localStorage.getItem('access_token');
  const showNav = !['landing', 'login', 'signup'].includes(currentView);
  const [navProfilePictureUrl, setNavProfilePictureUrl] = useState(null);
  const prevViewRef = useRef(currentView);

  useEffect(() => {
    if (!showNav || !localStorage.getItem('access_token')) return;
    fetch('/api/profile/me/', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setNavProfilePictureUrl(data.profile_picture_url || null))
      .catch(() => setNavProfilePictureUrl(null));
  }, [showNav]);

  useEffect(() => {
    if (prevViewRef.current === 'profile' && currentView !== 'profile') {
      fetch('/api/profile/me/', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setNavProfilePictureUrl(data.profile_picture_url || null))
        .catch(() => {});
    }
    prevViewRef.current = currentView;
  }, [currentView]);

  const handleNavigate = (view) => {
    if (view === 'logout') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('is_admin');
      setNavProfilePictureUrl(null);
      setCurrentView('landing');
      setClubDiscussionId(null);
      setProfileUserId(null);
      setViewShelfUserId(null);
    } else {
      setCurrentView(view);
      if (view !== 'clubdiscussion') setClubDiscussionId(null);
      if (view === 'profile') setProfileUserId(null);
      if (view === 'myshelf') { setViewShelfUserId(null); setViewShelfDisplayName(''); }
    }
  };

  const openProfile = (userId) => {
    setProfileUserId(userId ?? null);
    setCurrentView('profile');
  };

  const openChat = (userId, displayName) => {
    setChatWithUserId(userId ?? null);
    setChatWithDisplayName(displayName || '');
    setCurrentView('chat');
  };

  const openClubDiscussion = (clubId) => {
    setClubDiscussionId(clubId);
    setCurrentView('clubdiscussion');
  };

  const openViewShelf = (userId, displayName) => {
    setViewShelfUserId(userId);
    setViewShelfDisplayName(displayName || '');
    setCurrentView('myshelf');
  };

  const renderContent = () => {
    if (currentView === 'landing') return <LandingPage onNavigate={handleNavigate} />;
    if (currentView === 'login') return (
      <div className="auth-wrap">
        <Login onNavigate={handleNavigate} />
        <div className="view-toggle">
          <p>Don't have an account?{' '}
            <button onClick={() => setCurrentView('signup')} className="toggle-link">Sign up</button>
          </p>
        </div>
      </div>
    );
    if (currentView === 'signup') return (
      <div className="auth-wrap">
        <Signup onNavigate={handleNavigate} />
        <div className="view-toggle">
          <p>Already have an account?{' '}
            <button onClick={() => setCurrentView('login')} className="toggle-link">Login</button>
          </p>
        </div>
      </div>
    );
    if (currentView === 'dashboard') return isAdmin ? <AdminDashboard onNavigate={handleNavigate} onOpenClubDiscussion={openClubDiscussion} onOpenProfile={openProfile} onOpenChat={openChat} /> : <UserDashboard onNavigate={handleNavigate} onOpenClubDiscussion={openClubDiscussion} onOpenProfile={openProfile} onOpenChat={openChat} />;
    if (currentView === 'userdashboard') return <UserDashboard onNavigate={handleNavigate} onOpenClubDiscussion={openClubDiscussion} onOpenProfile={openProfile} onOpenChat={openChat} />;
    if (currentView === 'clubdiscussion') return clubDiscussionId ? <ClubDiscussion clubId={clubDiscussionId} onNavigate={handleNavigate} onOpenProfile={openProfile} isAppAdmin={isAdmin} backToView={isAdmin ? 'dashboard' : 'userdashboard'} /> : null;
    if (currentView === 'profile') return <Profile profileUserId={profileUserId} onNavigate={() => { setProfileUserId(null); handleNavigate(isAdmin ? 'dashboard' : 'userdashboard'); }} onOpenChat={openChat} onViewShelf={openViewShelf} />;
    if (currentView === 'chat') return chatWithUserId ? <Chat otherUserId={chatWithUserId} otherDisplayName={chatWithDisplayName} onClose={() => { setChatWithUserId(null); setCurrentView(isAdmin ? 'dashboard' : 'userdashboard'); }} /> : null;
    if (currentView === 'myshelf') return <MyShelf onNavigate={handleNavigate} viewUserId={viewShelfUserId} viewUserDisplayName={viewShelfDisplayName} />;
    if (currentView === 'search') return <SearchFilter onNavigate={handleNavigate} />;
    return null;
  };

  return (
    <div className="app">
      {showNav && (
        <header className="main-header">
          <div className="main-topbar">
            <span className="main-logo">StorySync</span>
          </div>
          <div className="main-navrow">
            <div className="main-avatar-wrap" onClick={() => handleNavigate('profile')}>
              <div className="main-avatar">
                {navProfilePictureUrl ? (
                  <img src={navProfilePictureUrl} alt="Profile" className="main-avatar-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('main-avatar-fallback-hidden'); }} />
                ) : null}
                <svg className={navProfilePictureUrl ? 'main-avatar-fallback-hidden' : ''} viewBox="0 0 24 24" fill="#aaa" width="24" height="24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            </div>
            <nav className="main-nav">
              <button className={`main-navlink ${(currentView === 'dashboard' || currentView === 'userdashboard') ? 'active' : ''}`} onClick={() => handleNavigate(isAdmin ? 'dashboard' : 'userdashboard')}>Home</button>
              <button className={`main-navlink ${currentView === 'myshelf' ? 'active' : ''}`} onClick={() => handleNavigate('myshelf')}>Shelf</button>
              <button className={`main-navlink ${currentView === 'search' ? 'active' : ''}`} onClick={() => handleNavigate('search')}>Search</button>
            </nav>
            <button className="main-logout" onClick={() => handleNavigate('logout')}>Logout</button>
          </div>
        </header>
      )}
            {renderContent()}
    </div>
  );
}

export default App;