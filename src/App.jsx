import { useEffect, useState } from 'react';
import { api } from './api';
import LoginScreen from './screens/LoginScreen';
import ChannelsScreen from './screens/ChannelsScreen';
import Spinner from './components/Spinner';

export default function App() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'auth' | 'ready'
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const data = await api.checkStatus();
      if (data.loggedIn) {
        setUser(data.user);
        setStatus('ready');
      } else {
        setStatus('auth');
      }
    } catch {
      setStatus('auth');
    }
  }

  async function handleLogout() {
    try { await api.logout(); } catch {}
    setUser(null);
    setStatus('auth');
  }

  if (status === 'loading') {
    return (
      <div className="center-screen">
        <Spinner />
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  if (status === 'auth') {
    return <LoginScreen onLoggedIn={checkAuth} />;
  }

  return <ChannelsScreen user={user} onLogout={handleLogout} />;
}
