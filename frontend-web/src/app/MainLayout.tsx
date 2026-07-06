import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '@shared/components/Icon';
import { useAuthStore } from '@features/auth/store/authStore';

const BASE_TABS = [
  { to: '/visit-city', label: 'Visit City', icon: 'travel-explore', iconActive: 'explore' },
  { to: '/tours', label: 'Tururi', icon: 'map', iconActive: 'map' },
  { to: '/profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

const ADMIN_TAB = {
  to: '/admin',
  label: 'Admin',
  icon: 'admin-panel-settings',
  iconActive: 'admin-panel-settings',
};

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const role = useAuthStore((s) => s.currentUser?.role);
  const TABS = role === 'admin' ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;
  return (
    <div className="app-shell">
      <div className="app-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
      <nav className="tab-bar">
        {TABS.map((tab) => {
          const active = location.pathname.startsWith(tab.to);
          return (
            <NavLink key={tab.to} to={tab.to} className={`tab-item${active ? ' active' : ''}`}>
              <Icon name={active ? tab.iconActive : tab.icon} size={24} />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
