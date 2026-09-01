import { Bell, HelpCircle, Search, User } from 'lucide-react';

interface Props {
  title?: string;
  showSearch?: boolean;
}

export default function ContentHeader({ title = 'Assessment Workbench', showSearch = true }: Props) {
  return (
    <header className="content-header">
      <span className="content-header-title">{title}</span>

      <div className="content-header-actions">
        {showSearch && (
          <div className="header-search">
            <Search size={14} />
            <input type="text" placeholder="Search..." />
          </div>
        )}
        <button className="header-icon-btn" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="header-icon-btn" aria-label="Help">
          <HelpCircle size={18} />
        </button>
        <button className="header-icon-btn" aria-label="Profile" style={{
          background: 'var(--color-bg)',
          borderRadius: '50%',
        }}>
          <User size={16} />
        </button>
      </div>
    </header>
  );
}
