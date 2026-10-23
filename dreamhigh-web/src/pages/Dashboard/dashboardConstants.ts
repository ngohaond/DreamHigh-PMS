import type { LucideIcon } from 'lucide-react';
import { createElement, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  PieChart,
  Settings,
  Shield,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
/** Icon dùng trên Dashboard (module + widget + getIcon helper) */
export type DashboardIconKey =
  | 'Calendar'
  | 'TrendingUp'
  | 'CheckCircle2'
  | 'History'
  | 'PieChart'
  | 'MapPin'
  | 'UserCheck'
  | 'CheckSquare'
  | 'ChevronRight'
  | 'UserPlus'
  | 'Users'
  | 'Layers'
  | 'ShieldCheck'
  | 'Shield'
  | 'BookOpen'
  | 'ClipboardList'
  | 'Settings'
  | 'GraduationCap'
  | 'Wallet'
  | 'BarChart3'
  | 'LayoutDashboard'
  | 'LogOut';

const iconMap: Record<DashboardIconKey, LucideIcon> = {
  Calendar,
  TrendingUp,
  CheckCircle2,
  History,
  PieChart,
  MapPin,
  UserCheck,
  CheckSquare,
  ChevronRight,
  UserPlus,
  Users,
  Layers,
  ShieldCheck,
  Shield,
  BookOpen,
  ClipboardList,
  Settings,
  GraduationCap,
  Wallet,
  BarChart3,
  LayoutDashboard,
  LogOut,
};

export function getIcon(name: DashboardIconKey, size: number, className?: string): ReactNode {
  const Icon = iconMap[name];
  return createElement(Icon, {
    size,
    className,
    strokeWidth: 2,
    'aria-hidden': true,
  });
}

export type DashboardModuleRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'TEACHER';

/**
 * Màu nền khối icon — map từ prototype (indigo/blue/…) sang token theme,
 * không dùng bg-indigo-500 / bg-blue-500 trên production.
 */
export type ModuleIconAccent =
  | 'gold'
  | 'midnight'
  | 'success'
  | 'info'
  | 'charcoal'
  | 'warning'
  | 'error';

export interface DashboardModuleDef {
  id: string;
  route: string;
  title: string;
  description: string;
  iconName: DashboardIconKey;
  accent: ModuleIconAccent;
  roles?: DashboardModuleRole[];
}

const ACCENT_BOX: Record<ModuleIconAccent, string> = {
  gold: 'bg-gold text-white shadow-inner',
  midnight: 'bg-midnight text-gold shadow-inner',
  success: 'bg-success text-white shadow-inner',
  info: 'bg-info text-white shadow-inner',
  charcoal: 'bg-charcoal text-gold shadow-inner',
  warning: 'bg-warning text-midnight shadow-inner',
  error: 'bg-error text-white shadow-inner',
};

export function moduleIconAccentClass(accent: ModuleIconAccent): string {
  return ACCENT_BOX[accent];
}

/**
 * Nghiệp vụ vận hành theo BA (dashboard module grid).
 * `color` prototype → `accent` (Design System).
 */
export const MODULES: DashboardModuleDef[] = [
  {
    id: 'leads',
    route: '/crm/leads',
    title: 'Tiềm năng (Leads)',
    description: 'Pipeline tuyển sinh',
    iconName: 'UserPlus',
    accent: 'info',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'category',
    route: '/admin/categories',
    title: 'Danh mục',
    description: 'Cấu hình phòng học, ca học, loại phí…',
    iconName: 'Settings',
    accent: 'info',
    roles: ['ADMIN'],
  },
  {
    id: 'curriculum',
    route: '/courses',
    title: 'Chương trình học',
    description: 'Thiết kế Syllabus và lộ trình đào tạo',
    iconName: 'GraduationCap',
    accent: 'charcoal',
    roles: ['ADMIN'],
  },
  {
    id: 'courses',
    route: '/classes',
    title: 'Khóa học',
    description: 'Quản lý khóa học, giảng viên, thời lượng',
    iconName: 'BookOpen',
    accent: 'gold',
    roles: ['ADMIN', 'MANAGER', 'STAFF', 'TEACHER'],
  },
  {
    id: 'students',
    route: '/crm/students',
    title: 'Học viên',
    description: 'Hồ sơ học viên, học bổng và bảo lưu',
    iconName: 'Users',
    accent: 'success',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'classes',
    route: '/classes',
    title: 'Lịch học',
    description: 'Điều phối lớp, xếp phòng và lịch dạy',
    iconName: 'Calendar',
    accent: 'warning',
    roles: ['ADMIN', 'MANAGER', 'STAFF', 'TEACHER'],
  },
  {
    id: 'my-schedule',
    route: '/classes/my-schedule',
    title: 'Lịch cá nhân',
    description: 'Lịch dạy cá nhân theo tuần',
    iconName: 'ClipboardList',
    accent: 'info',
    roles: ['ADMIN', 'MANAGER', 'STAFF', 'TEACHER'],
  },
  {
    id: 'teaching-hours',
    route: '/reports/teaching-hours',
    title: 'Giờ dạy',
    description: 'Tổng hợp giờ dạy theo giáo viên',
    iconName: 'TrendingUp',
    accent: 'charcoal',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'teachers',
    route: '/hr/teachers',
    title: 'Giáo viên',
    description: 'Nhân sự giảng dạy và thù lao',
    iconName: 'UserCheck',
    accent: 'charcoal',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'finance',
    route: '/finance',
    title: 'Tài chính',
    description: 'Thu phí, chi phí và công nợ',
    iconName: 'Wallet',
    accent: 'success',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'reports',
    route: '/admin/audit-logs',
    title: 'Báo cáo',
    description: 'Phân tích doanh thu và hiệu quả',
    iconName: 'BarChart3',
    accent: 'error',
    roles: ['ADMIN'],
  },
  {
    id: 'admin',
    route: '/admin/users',
    title: 'Hệ thống',
    description: 'Phân quyền, người dùng và bảo mật',
    iconName: 'Shield',
    accent: 'midnight',
    roles: ['ADMIN'],
  },
];

/** @deprecated Dùng MODULES; giữ alias cho import cũ. */
export const DASHBOARD_MODULES = MODULES;

export function filterModulesForUserRoles(
  modules: DashboardModuleDef[],
  userRoles: string[] | undefined,
): DashboardModuleDef[] {
  const r = userRoles ?? [];
  return modules.filter((m) => {
    if (!m.roles?.length) return true;
    return m.roles.some((role) => r.includes(role));
  });
}
