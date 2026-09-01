import { useEffect, useState } from 'react';
import { api } from '../api';
import Spinner from '../components/Spinner';
import ChannelItem from '../components/ChannelItem';

const FILTER = {
  ALL: 'all',
  CHANNELS: 'channels',
  GROUPS: 'groups',
};

export default function ChannelsScreen({ user, onLogout }) {
  const [dialogs, setDialogs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState(FILTER.ALL);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadDialogs();
  }, []);

  async function loadDialogs() {
    setLoading(true);
    setError('');
    setSelected(new Set());
    setResult(null);
    try {
      const data = await api.getChannels();
      setDialogs(data.dialogs || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(d => d.id)));
    }
  }

  async function handleLeave() {
    if (selected.size === 0) return;
    if (!window.confirm(`Leave ${selected.size} selected chat${selected.size > 1 ? 's' : ''}?`)) return;

    setLeaving(true);
    setError('');
    try {
      const res = await api.leaveChannels([...selected]);
      setResult(res);
      // Remove successfully left dialogs from the list
      setDialogs(prev => prev.filter(d => !res.success.includes(d.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave some chats');
    } finally {
      setLeaving(false);
    }
  }

  // Filter and search
  const filtered = dialogs.filter(d => {
    const matchFilter =
      filter === FILTER.ALL ||
      (filter === FILTER.CHANNELS && d.type === 'channel') ||
      (filter === FILTER.GROUPS && (d.type === 'group' || d.type === 'supergroup'));
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="screen channels-screen">
      {/* Header */}
      <div className="channels-header">
        <div className="header-top">
          <div>
            <h2 className="header-title">My Chats</h2>
            <p className="header-sub">{dialogs.length} chats total</p>
          </div>
          <button className="btn-icon btn-logout" onClick={onLogout} title="Logout">
            🚪
          </button>
        </div>

        {/* Search */}
        <input
          className="search-input"
          type="text"
          placeholder="🔍 Search chats..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Filter tabs */}
        <div className="filter-tabs">
          {Object.values(FILTER).map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === FILTER.ALL ? '📋 All' : f === FILTER.CHANNELS ? '📢 Channels' : '👥 Groups'}
            </button>
          ))}
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className="result-banner">
          ✅ Left {result.success.length} chat{result.success.length !== 1 ? 's' : ''}
          {result.failed.length > 0 && ` · ⚠️ ${result.failed.length} failed`}
          <button className="banner-close" onClick={() => setResult(null)}>✕</button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button className="banner-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="center-screen">
          <Spinner />
          <p className="loading-text">Loading your chats...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <p className="empty-title">{search ? 'No results' : 'Nothing to leave!'}</p>
          <p className="empty-sub">{search ? 'Try a different search term' : 'You have no channels or groups to leave.'}</p>
          {!search && (
            <button className="btn btn-ghost" onClick={loadDialogs}>Refresh</button>
          )}
        </div>
      ) : (
        <>
          {/* Select all */}
          <div className="select-all-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span>{allSelected ? 'Deselect all' : `Select all (${filtered.length})`}</span>
            </label>
            <button className="btn-icon btn-refresh" onClick={loadDialogs} title="Refresh">
              🔄
            </button>
          </div>

          {/* List */}
          <div className="channels-list">
            {filtered.map(dialog => (
              <ChannelItem
                key={dialog.id}
                dialog={dialog}
                selected={selected.has(dialog.id)}
                onToggle={() => toggleSelect(dialog.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div className="action-bar">
          <div className="action-bar-inner">
            <span className="selected-count">{selected.size} selected</span>
            <button
              className="btn btn-danger"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving ? 'Leaving...' : `🚪 Leave ${selected.size} chat${selected.size > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
