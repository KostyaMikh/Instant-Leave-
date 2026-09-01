export default function ChannelItem({ dialog, selected, onToggle }) {
  const typeLabel = {
    channel: '📢',
    supergroup: '👥',
    group: '👥',
  }[dialog.type] || '💬';

  const initials = dialog.title
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`channel-item ${selected ? 'selected' : ''}`}
      onClick={onToggle}
    >
      <div className="channel-avatar" style={{ background: stringToColor(dialog.title) }}>
        {initials}
      </div>
      <div className="channel-info">
        <span className="channel-title">{dialog.title}</span>
        <span className="channel-meta">
          {typeLabel} {dialog.type}
          {dialog.membersCount ? ` · ${formatCount(dialog.membersCount)} members` : ''}
        </span>
      </div>
      <div className="channel-checkbox">
        <div className={`custom-checkbox ${selected ? 'checked' : ''}`}>
          {selected && <span>✓</span>}
        </div>
      </div>
    </div>
  );
}

function stringToColor(str) {
  const colors = [
    '#E57373', '#F06292', '#BA68C8', '#9575CD',
    '#7986CB', '#64B5F6', '#4FC3F7', '#4DD0E1',
    '#4DB6AC', '#81C784', '#AED581', '#FFD54F',
    '#FFB74D', '#FF8A65', '#A1887F', '#90A4AE',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
  return colors[hash % colors.length];
}

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n;
}
