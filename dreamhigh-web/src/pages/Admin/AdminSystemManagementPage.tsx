import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Card } from '../../design-system/components/ui/Card';
import { MOCK_ACTIVITY_LOGS, MOCK_ROLES } from '../../mock/adminSystem';
import type { AdminMessage, Branch, Permission, SystemRole, SystemUser, UserStatus } from '../../types/adminSystem';
import { apiClient } from '../../services/apiClient';
import { getIcon } from './system/adminSystemIcons';
import NotificationPortal from './system/NotificationPortal';
import SystemUserModal from './system/SystemUserModal';
import AdminTabButton from './system/AdminTabButton';
import type { PermissionField } from './system/PermissionCheckbox';
import AdminUsersTab from './system/tabs/AdminUsersTab';
import AdminRolesTab from './system/tabs/AdminRolesTab';
import AdminLogsTab from './system/tabs/AdminLogsTab';
import AdminBranchesTab from './system/tabs/AdminBranchesTab';
import AdminSettingsTab from './system/tabs/AdminSettingsTab';

type AdminTab = 'users' | 'roles' | 'logs' | 'branches' | 'settings';

type ApiUserRow = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone?: string | null;
  roles: string[];
  branchIds: number[];
  status: string;
};

type ApiRoleRow = { id: number; code: string; name: string; description: string | null };

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { message?: string | string[] } } }).response?.data;
    const m = data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

function mapApiUserToSystemUser(u: ApiUserRow): SystemUser {
  const uiStatus: UserStatus =
    u.status === 'ACTIVE' ? 'Active' : u.status === 'INACTIVE' ? 'Suspended' : 'Suspended';
  return {
    id: String(u.id),
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone ?? undefined,
    roles: u.roles ?? [],
    branchIds: (u.branchIds ?? []).map(String),
    lastLogin: undefined,
    status: uiStatus,
  };
}

const AdminSystemManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [logs] = useState(MOCK_ACTIVITY_LOGS);
  const [message, setMessage] = useState<AdminMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [userModalNonce, setUserModalNonce] = useState(0);
  const [rolesState, setRolesState] = useState<SystemRole[]>([]);

  const { data: users = [], isLoading: loadUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await apiClient.get('/users');
      const list = r.data.data as ApiUserRow[];
      return list.map(mapApiUserToSystemUser);
    },
  });

  const { data: apiRoles = [], isLoading: loadRoles } = useQuery({
    queryKey: ['admin-lookup-roles'],
    queryFn: async () => {
      const r = await apiClient.get('/users/lookup/roles');
      return r.data as ApiRoleRow[];
    },
  });

  const roles: SystemRole[] = useMemo(
    () =>
      apiRoles.map((ar) => {
        const mock = MOCK_ROLES.find((m) => m.code === ar.code);
        return {
          id: String(ar.id),
          code: ar.code,
          name: ar.name,
          description: (ar.description?.trim() || mock?.description || '—') as string,
          permissions: mock?.permissions ?? [],
        };
      }),
    [apiRoles],
  );
  const effectiveSelectedRoleId = roles.some((role) => role.id === selectedRoleId)
    ? selectedRoleId
    : roles[0]?.id ?? '';

  const { data: branchesRaw = [] } = useQuery({
    queryKey: ['catalog-branches'],
    queryFn: async () => {
      const r = await apiClient.get('/categories/branches');
      return r.data as Array<{
        id: number;
        code: string;
        name: string;
        address?: string | null;
        phone?: string | null;
        status: string;
      }>;
    },
  });

  const branches: Branch[] = useMemo(
    () =>
      branchesRaw.map((b) => ({
        id: String(b.id),
        code: b.code,
        name: b.name,
        hotline: b.phone?.trim() || '—',
        email: '—',
        address: b.address?.trim() || '—',
        status: b.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng',
      })),
    [branchesRaw],
  );

  const handleOpenCreateUser = () => {
    setUserModalNonce((n) => n + 1);
    setEditingUser(null);
    setIsReadOnly(false);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: SystemUser) => {
    setUserModalNonce((n) => n + 1);
    setEditingUser(user);
    setIsReadOnly(false);
    setIsUserModalOpen(true);
  };

  const handleOpenViewUser = (user: SystemUser) => {
    setUserModalNonce((n) => n + 1);
    setEditingUser(user);
    setIsReadOnly(true);
    setIsUserModalOpen(true);
  };

  const createUserMutation = useMutation({
    mutationFn: async (payload: { user: SystemUser; password: string }) => {
      const { user, password } = payload;
      await apiClient.post('/users', {
        username: user.username.trim(),
        email: user.email.trim(),
        fullName: user.fullName.trim(),
        phone: user.phone?.trim() || undefined,
        password,
        roles: user.roles,
        branchIds: user.branchIds.map(Number),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage({
        code: 'ADM-USER-201',
        text: 'Đã tạo tài khoản thành công.',
        type: 'success',
      });
      setIsUserModalOpen(false);
    },
    onError: (err: unknown) => {
      setMessage({ code: 'ADM-USER-ERR', text: apiErrorMessage(err), type: 'error' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: { user: SystemUser; password?: string }) => {
      const { user, password } = payload;
      const body: Record<string, unknown> = {
        email: user.email.trim(),
        fullName: user.fullName.trim(),
        phone: user.phone === undefined || user.phone === '' ? null : user.phone.trim(),
        roles: user.roles,
        branchIds: user.branchIds.map(Number),
        status: user.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
      };
      if (password && password.length >= 6) body.password = password;
      await apiClient.patch(`/users/${user.id}`, body);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage({
        code: 'ADM-USER-200',
        text: `Đã cập nhật tài khoản ${variables.user.username} thành công.`,
        type: 'success',
      });
      setIsUserModalOpen(false);
    },
    onError: (err: unknown) => {
      setMessage({ code: 'ADM-USER-ERR', text: apiErrorMessage(err), type: 'error' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (payload: { id: string; next: 'ACTIVE' | 'INACTIVE' }) => {
      await apiClient.patch(`/users/${payload.id}`, { status: payload.next });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage({
        code: 'ADM-200',
        text:
          variables.next === 'INACTIVE'
            ? 'Đã đặt trạng thái tài khoản thành không hoạt động.'
            : 'Đã kích hoạt lại tài khoản.',
        type: variables.next === 'INACTIVE' ? 'warning' : 'success',
      });
    },
    onError: (err: unknown) => {
      setMessage({ code: 'ADM-ERR', text: apiErrorMessage(err), type: 'error' });
    },
  });

  const handleSaveUser = (userData: SystemUser, password?: string) => {
    if (editingUser) {
      updateUserMutation.mutate({ user: userData, password });
      return;
    }
    if (!password || password.length < 6) {
      setMessage({
        code: 'ADM-PWD',
        text: 'Mật khẩu tạo tài khoản phải từ 6 ký tự trở lên.',
        type: 'error',
      });
      return;
    }
    createUserMutation.mutate({ user: userData, password });
  };

  const handleToggleUserStatus = (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    const next: 'ACTIVE' | 'INACTIVE' = u.status === 'Active' ? 'INACTIVE' : 'ACTIVE';
    toggleStatusMutation.mutate({ id, next });
  };

  const handleTogglePermission = (moduleId: string, field: PermissionField) => {
    const selected = rolesState.find((r) => r.id === effectiveSelectedRoleId);
    if (selected?.code === 'ADMIN') {
      setMessage({
        code: 'WARN-RBAC',
        text: 'Không thể chỉnh sửa quyền của Super Admin hệ thống.',
        type: 'warning',
      });
      return;
    }

    setRolesState((prev) =>
      prev.map((role) => {
        if (role.id !== effectiveSelectedRoleId) return role;
        const next = [...role.permissions];
        const idx = next.findIndex((p) => p.moduleId === moduleId);
        if (idx !== -1) {
          const updated: Permission = { ...next[idx], [field]: !next[idx][field] };
          next[idx] = updated;
        } else {
          const created: Permission = {
            moduleId,
            canView: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canApprove: false,
            [field]: true,
          };
          next.push(created);
        }
        return { ...role, permissions: next };
      }),
    );
  };

  const handleSaveRoles = () => {
    const selected = rolesState.find((r) => r.id === effectiveSelectedRoleId);
    setMessage({
      code: 'ADM-RBAC-200',
      text: `Đã lưu cấu hình phân quyền cho vai trò ${selected?.name ?? ''}.`,
      type: 'success',
    });
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <AppLayout>
      <NotificationPortal message={message} onClose={() => setMessage(null)} />

      <PageHeader
        title="Quản trị hệ thống"
        breadcrumb={[
          { label: 'Hệ thống', href: '#' },
          { label: 'Quản trị' },
        ]}
      />

      <div className="flex flex-col space-y-6 animate-fade-in">
        <Card className="p-6 shadow-md">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                {getIcon('Shield', 24)}
              </span>
              <div>
                <p className="font-body text-sm text-midnight/50">
                  Bảo mật, phân quyền theo cấu hình nghiệp vụ — danh sách người dùng đồng bộ API.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto rounded-xl bg-midnight/5 p-1.5">
              <AdminTabButton active={activeTab === 'users'} label="Người dùng" icon="Users" onClick={() => setActiveTab('users')} />
              <AdminTabButton
                active={activeTab === 'roles'}
                label="Vai trò & quyền"
                icon="Lock"
                onClick={() => setActiveTab('roles')}
              />
              <AdminTabButton active={activeTab === 'logs'} label="Log thao tác" icon="Server" onClick={() => setActiveTab('logs')} />
              <AdminTabButton active={activeTab === 'branches'} label="Chi nhánh" icon="Globe" onClick={() => setActiveTab('branches')} />
              <AdminTabButton active={activeTab === 'settings'} label="Cấu hình" icon="Settings" onClick={() => setActiveTab('settings')} />
            </div>
          </div>
        </Card>

        {activeTab === 'users' && (
          <AdminUsersTab
            users={filteredUsers}
            roles={roles}
            branches={branches}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onCreate={handleOpenCreateUser}
            onView={handleOpenViewUser}
            onEdit={handleOpenEditUser}
            onToggleStatus={handleToggleUserStatus}
            isLoading={loadUsers}
          />
        )}

        {activeTab === 'roles' && loadRoles ? (
          <Card className="p-10 text-center font-body text-sm text-midnight/45 shadow-md">Đang tải vai trò…</Card>
        ) : null}

        {activeTab === 'roles' && !loadRoles && rolesState.length > 0 ? (
          <AdminRolesTab
            roles={rolesState}
            selectedRoleId={effectiveSelectedRoleId}
            onSelectRole={setSelectedRoleId}
            onTogglePermission={handleTogglePermission}
            onSave={handleSaveRoles}
          />
        ) : null}

        {activeTab === 'roles' && !loadRoles && rolesState.length === 0 ? (
          <Card className="p-10 text-center font-body text-sm text-midnight/45 shadow-md">Không có vai trò nào.</Card>
        ) : null}

        {activeTab === 'logs' && <AdminLogsTab logs={logs} />}

        {activeTab === 'branches' && <AdminBranchesTab branches={branches} />}

        {activeTab === 'settings' && <AdminSettingsTab />}
      </div>

      <SystemUserModal
        key={`${editingUser?.id ?? 'new'}-${userModalNonce}-${isReadOnly}`}
        isOpen={isUserModalOpen}
        user={editingUser}
        isReadOnly={isReadOnly}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        roles={roles}
        branches={branches}
      />
    </AppLayout>
  );
};

export default AdminSystemManagementPage;
