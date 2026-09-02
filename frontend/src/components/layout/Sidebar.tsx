import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Clock, Plus, Settings, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, closeSidebar, openSidebar } = useSidebar();

  const isNewGradingActive = location.pathname === '/' || location.pathname.startsWith('/review');
  const isHistoryActive = location.pathname === '/history';
  const isSettingsActive = location.pathname === '/settings';

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : 'mini'}`}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-content" onClick={!isOpen ? openSidebar : undefined} style={{ cursor: !isOpen ? 'pointer' : 'default' }}>
          <div className="sidebar-brand-logo" title={!isOpen ? "Gradent AI (Click to expand)" : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {isOpen && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Gradent AI</span>
              <span className="sidebar-brand-tag">Assessment System</span>
            </div>
          )}
        </div>

        {isOpen ? (
          <button
            className="sidebar-toggle-btn"
            onClick={closeSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        ) : (
          <button
            className="sidebar-toggle-btn"
            onClick={openSidebar}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Action Button: New Grading */}
        <button
          className={`sidebar-btn-new ${isNewGradingActive ? 'active' : ''}`}
          onClick={() => navigate('/')}
          title={!isOpen ? "New Grading" : undefined}
          aria-label="New Grading"
        >
          <Plus size={18} />
          {isOpen && <span>New Grading</span>}
        </button>

        <div className="sidebar-nav-list">
          <NavLink
            to="/history"
            className={() => `sidebar-link ${isHistoryActive ? 'active' : ''}`}
            title={!isOpen ? "History" : undefined}
          >
            <Clock size={18} />
            {isOpen && <span>History</span>}
          </NavLink>

          <NavLink
            to="/settings"
            className={() => `sidebar-link ${isSettingsActive ? 'active' : ''}`}
            title={!isOpen ? "Settings" : undefined}
          >
            <Settings size={18} />
            {isOpen && <span>Settings</span>}
          </NavLink>
        </div>
      </nav>

      {/* Footer / Teacher Profile */}
      <div className="sidebar-footer">
        <button
          className="sidebar-user-btn"
          title={!isOpen ? "Teacher Profile (Evaluator / Teacher's Name)" : undefined}
        >
          <div className="sidebar-user-avatar">
            <User size={16} />
          </div>
          {isOpen && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">Teacher's Name</span>
              <span className="sidebar-user-role">Teacher / Evaluator</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}




