import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, Search, User, LogOut, Settings as SettingsIcon, PanelLeftOpen } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';

interface Props {
  title?: string;
  showSearch?: boolean;
}

export default function ContentHeader({ title = 'Assessment Workbench', showSearch = true }: Props) {
  const { isOpen, openSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
    navigate('/login');
  };

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

        {/* Profile Avatar with Interactive Dropdown Menu */}
        <div className="header-profile-wrapper" ref={menuRef}>
          <button
            className="header-icon-btn"
            aria-label="Account profile menu"
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              background: isMenuOpen ? 'var(--color-primary)' : 'var(--color-bg)',
              color: isMenuOpen ? '#ffffff' : 'var(--color-text)',
              borderRadius: '50%',
              transition: 'all var(--transition-fast)',
            }}
          >
            <User size={16} />
          </button>

          {isMenuOpen && (
            <div className="header-dropdown-menu" role="menu">
              <div className="header-dropdown-user">
                <span className="header-dropdown-name">{user?.full_name || 'Evaluator'}</span>
                <span className="header-dropdown-email">{user?.email || ''}</span>
              </div>

              <button
                type="button"
                className="header-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/profile');
                }}
              >
                <User size={15} color="var(--color-text-secondary)" />
                <span>View Profile</span>
              </button>

              <button
                type="button"
                className="header-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/profile');
                }}
              >
                <SettingsIcon size={15} color="var(--color-text-secondary)" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                className="header-dropdown-item logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
