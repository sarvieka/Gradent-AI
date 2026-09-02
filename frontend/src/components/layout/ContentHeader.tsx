import { Bell, HelpCircle, Search, User, PanelLeftOpen } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

interface Props {
  title?: string;
  showSearch?: boolean;
}

export default function ContentHeader({ title = 'Assessment Workbench', showSearch = true }: Props) {
  const { isOpen, openSidebar } = useSidebar();

  return (
    <header className="content-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {!isOpen && (
          <button
            onClick={openSidebar}
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Expand navigation sidebar"
            aria-label="Expand navigation sidebar"
          >
            <PanelLeftOpen size={16} />
            <span>Navigation</span>
          </button>
        )}
        <span className="content-header-title">{title}</span>
      </div>

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
