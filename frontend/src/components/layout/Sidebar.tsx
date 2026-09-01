import { NavLink, useNavigate } from 'react-router-dom';
import { Clock, Plus, Settings, User } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">G</div>
        <div className="sidebar-brand-text">
          <h1>GradeMaster AI</h1>
          <span>Institutional Pro</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-btn-new" onClick={() => navigate('/')}>
          <Plus size={16} />
          New Grading
        </button>

        <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Clock size={18} />
          History
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings size={18} />
          Settings
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-link">
          <User size={18} />
          Teacher Profile
        </button>
      </div>
    </aside>
  );
}
