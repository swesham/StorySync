import { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import MyShelf from './components/MyShelf';
import Explore from './components/Explore';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ClubDiscussion from './components/ClubDiscussion';
import ClubShelf from './components/ClubShelf';
import Clubs from './components/Clubs';
import Profile from './components/Profile';
import EditPreferences from './components/EditPreferences';
import Chat from './components/Chat';
import './App.css';

const LS_ROUTE_KEYS = [
  'app_club_discussion_id',
  'app_club_shelf_initial_id',
  'app_profile_user_id',
  'app_view_shelf_user_id',
  'app_view_shelf_display_name',
  'app_chat_user_id',
  'app_chat_display_name',
];

function clearStoredRouteExtras() {
  LS_ROUTE_KEYS.forEach((k) => localStorage.removeItem(k));
}

function readNum(key) {
  const v = localStorage.getItem(key);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Restore view + ids so refresh stays on club chat, etc. */
function loadPersistedRoute() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    clearStoredRouteExtras();
    localStorage.removeItem('current_view');
    return {
      currentView: 'landing',
      clubDiscussionId: null,
      clubShelfInitialId: null,
      profileUserId: null,
      viewShelfUserId: null,
      viewShelfDisplayName: '',
      chatWithUserId: null,
      chatWithDisplayName: '',
    };
  }

  const rawSaved = localStorage.getItem('current_view');
  let currentView =
    rawSaved && !['landing', 'login', 'signup'].includes(rawSaved)
      ? rawSaved
      : sessionStorage.getItem('is_admin') === 'true'
        ? 'dashboard'
        : 'userdashboard';

  const clubDiscussionId = readNum('app_club_discussion_id');
  const clubShelfInitialId = readNum('app_club_shelf_initial_id');
  const profileUserId = readNum('app_profile_user_id');
  const viewShelfUserId = readNum('app_view_shelf_user_id');
  const viewShelfDisplayName = localStorage.getItem('app_view_shelf_display_name') || '';
  const chatWithUserId = readNum('app_chat_user_id');
  const chatWithDisplayName = localStorage.getItem('app_chat_display_name') || '';

  const home = sessionStorage.getItem('is_admin') === 'true' ? 'dashboard' : 'userdashboard';
  if (currentView === 'clubdiscussion' && clubDiscussionId == null) currentView = home;
  if (currentView === 'chat' && chatWithUserId == null) currentView = home;

  return {
    currentView,
    clubDiscussionId: currentView === 'clubdiscussion' ? clubDiscussionId : null,
    clubShelfInitialId: currentView === 'clubshelf' ? clubShelfInitialId : null,
    profileUserId: currentView === 'profile' ? profileUserId : null,
    viewShelfUserId: currentView === 'myshelf' ? viewShelfUserId : null,
    viewShelfDisplayName: currentView === 'myshelf' ? viewShelfDisplayName : '',
    chatWithUserId: currentView === 'chat' ? chatWithUserId : null,
    chatWithDisplayName: currentView === 'chat' ? chatWithDisplayName : '',
  };
}

function App() {
  const persisted = loadPersistedRoute();
  const [clubDiscussionId, setClubDiscussionId] = useState(persisted.clubDiscussionId);
  const [clubShelfInitialId, setClubShelfInitialId] = useState(persisted.clubShelfInitialId);
  const [profileUserId, setProfileUserId] = useState(persisted.profileUserId);
  const [viewShelfUserId, setViewShelfUserId] = useState(persisted.viewShelfUserId);
  const [viewShelfDisplayName, setViewShelfDisplayName] = useState(persisted.viewShelfDisplayName);
  const [chatWithUserId, setChatWithUserId] = useState(persisted.chatWithUserId);
  const [chatWithDisplayName, setChatWithDisplayName] = useState(persisted.chatWithDisplayName);
  const [currentView, setCurrentView] = useState(persisted.currentView);
  const isAdmin = sessionStorage.getItem('is_admin') === 'true';

  const isLoggedIn = !!localStorage.getItem('access_token');
  const showNav = !['landing', 'login', 'signup'].includes(currentView);
  const [navProfilePictureUrl, setNavProfilePictureUrl] = useState(null);
  const prevViewRef = useRef(currentView);

  useEffect(() => {
    const state = { view: currentView };
    if (window.history.state?.view !== currentView) {
      window.history.pushState(state, '', `#${currentView}`);
    }
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('current_view', currentView);
    const setOrRemove = (key, val) => {
      if (val != null && val !== '') localStorage.setItem(key, String(val));
      else localStorage.removeItem(key);
    };
    setOrRemove('app_club_discussion_id', clubDiscussionId);
    setOrRemove('app_club_shelf_initial_id', clubShelfInitialId);
    setOrRemove('app_profile_user_id', profileUserId);
    setOrRemove('app_view_shelf_user_id', viewShelfUserId);
    if (viewShelfDisplayName) localStorage.setItem('app_view_shelf_display_name', viewShelfDisplayName);
    else localStorage.removeItem('app_view_shelf_display_name');
    setOrRemove('app_chat_user_id', chatWithUserId);
    if (chatWithDisplayName) localStorage.setItem('app_chat_display_name', chatWithDisplayName);
    else localStorage.removeItem('app_chat_display_name');
  }, [
    currentView,
    clubDiscussionId,
    clubShelfInitialId,
    profileUserId,
    viewShelfUserId,
    viewShelfDisplayName,
    chatWithUserId,
    chatWithDisplayName,
  ]);

  useEffect(() => {
    const handlePopState = (e) => {
      const token = localStorage.getItem('access_token');
      if (e.state?.view) {
        const view = e.state.view;
        if (!token) {
          if (['landing', 'login', 'signup'].includes(view)) {
            setCurrentView(view);
          } else {
            setCurrentView('landing'); 
          }
        } else {
          if (['landing', 'login', 'signup'].includes(view)) {
            setCurrentView(sessionStorage.getItem('is_admin') === 'true' ? 'dashboard' : 'userdashboard');
          } else {
            setCurrentView(view);
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      localStorage.removeItem('current_view');
      clearStoredRouteExtras();
      sessionStorage.removeItem('is_admin');
      setNavProfilePictureUrl(null);
      setCurrentView('landing');
      setClubDiscussionId(null);
      setClubShelfInitialId(null);
      setProfileUserId(null);
      setViewShelfUserId(null);
      setViewShelfDisplayName('');
      setChatWithUserId(null);
      setChatWithDisplayName('');
    } else {
      if (view === 'clubshelf') setClubShelfInitialId(null);
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

  const openClubShelf = (clubId) => {
    setClubShelfInitialId(clubId ?? null);
    setCurrentView('clubshelf');
  };

  const openViewShelf = (userId, displayName) => {
    setViewShelfUserId(userId);
    setViewShelfDisplayName(displayName || '');
    setCurrentView('myshelf');
  };

  const renderContent = () => {
    const dashboard = isAdmin
      ? <AdminDashboard onNavigate={handleNavigate} onOpenClubDiscussion={openClubDiscussion} onOpenProfile={openProfile} onOpenChat={openChat} />
      : <UserDashboard onNavigate={handleNavigate} onOpenClubDiscussion={openClubDiscussion} onOpenProfile={openProfile} onOpenChat={openChat} />;
  
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
    if (currentView === 'dashboard') return dashboard;
    if (currentView === 'userdashboard') return <UserDashboard onNavigate={handleNavigate} onOpenClubDiscussion={openClubDiscussion} onOpenProfile={openProfile} onOpenChat={openChat} />;
    if (currentView === 'clubdiscussion') {
      if (!clubDiscussionId) return dashboard;
      return (
        <ClubDiscussion
          clubId={clubDiscussionId}
          onNavigate={handleNavigate}
          onOpenProfile={openProfile}
          onViewClubShelf={openClubShelf}
          isAppAdmin={isAdmin}
          backToView={isAdmin ? 'dashboard' : 'userdashboard'}
        />
      );
    }
    if (currentView === 'profile') {
      return (
        <Profile
          profileUserId={profileUserId}
          onNavigate={() => { setProfileUserId(null); handleNavigate(isAdmin ? 'dashboard' : 'userdashboard'); }}
          onOpenChat={openChat}
          onViewShelf={openViewShelf}
          onEditPreferences={() => setCurrentView('editpreferences')}
        />
      );
    }
    if (currentView === 'editpreferences') {
      return <EditPreferences onBack={() => setCurrentView('profile')} />;
    }
    if (currentView === 'chat') {
      if (!chatWithUserId) return dashboard;
      return <Chat otherUserId={chatWithUserId} otherDisplayName={chatWithDisplayName} onClose={() => { setChatWithUserId(null); setCurrentView(isAdmin ? 'dashboard' : 'userdashboard'); }} />;
    }
    if (currentView === 'myshelf') return <MyShelf onNavigate={handleNavigate} viewUserId={viewShelfUserId} viewUserDisplayName={viewShelfDisplayName} />;
    if (currentView === 'clubshelf') {
      return <ClubShelf onNavigate={handleNavigate} initialClubId={clubShelfInitialId} />;
    }
    if (currentView === 'clubs') return <Clubs onOpenClubDiscussion={openClubDiscussion} />;
    if (currentView === 'search') return <MyShelf onNavigate={handleNavigate} viewUserId={viewShelfUserId} viewUserDisplayName={viewShelfDisplayName} />;
    if (currentView === 'explore') return <Explore />;
    return dashboard;
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
              <button className={`main-navlink ${currentView === 'clubshelf' ? 'active' : ''}`} onClick={() => handleNavigate('clubshelf')}>Club Shelf</button>
              <button className={`main-navlink ${currentView === 'clubs' ? 'active' : ''}`} onClick={() => handleNavigate('clubs')}>Clubs</button>
              <button className={`main-navlink ${currentView === 'explore' ? 'active' : ''}`} onClick={() => handleNavigate('explore')}>Explore</button>
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