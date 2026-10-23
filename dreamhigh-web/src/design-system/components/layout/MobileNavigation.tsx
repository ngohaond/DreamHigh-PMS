import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/useAuthStore';
import {
  filterModulesForUserRoles,
  getIcon,
  MODULES,
  type DashboardIconKey,
} from '../../../pages/Dashboard/dashboardConstants';

const PRIORITY_ROUTES = ['/crm/students', '/classes', '/classes/my-schedule', '/finance', '/reports/teaching-hours'];

function isActive(pathname: string, route: string) {
  return route === '/dashboard' ? pathname === route : pathname === route || pathname.startsWith(`${route}/`);
}

export function MobileNavigation() {
  const roles = useAuthStore((state) => state.user?.roles);
  const location = useLocation();
  const navigate = useNavigate();
  const modules = filterModulesForUserRoles(MODULES, roles);
  const shortcuts = PRIORITY_ROUTES
    .map((route) => modules.find((module) => module.route === route))
    .filter((module): module is (typeof modules)[number] => module !== undefined)
    .slice(0, 3);
  const items = [
    { route: '/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard' as DashboardIconKey },
    ...shortcuts.map((module) => ({ route: module.route, label: module.title, icon: module.iconName })),
  ];

  return (
    <nav
      aria-label="Điều hướng chính trên thiết bị di động"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-midnight/10 bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(17,24,39,0.08)] backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const active = isActive(location.pathname, item.route);
        return (
          <button
            key={item.route}
            type="button"
            onClick={() => navigate(item.route)}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${active ? 'text-gold' : 'text-midnight/55'}`}
          >
            {getIcon(item.icon, 19)}
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}