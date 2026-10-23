import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { PasswordInput } from '../../design-system/components/ui/Input';

// Password Change Schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải từ 8 ký tự trở lên')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, 'Mật khẩu phải chứa chữ hoa, chữ thường và số'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: profileData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const resp = await apiClient.get('/users/profile');
      return resp.data.data;
    }
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      await apiClient.patch('/users/change-password', {
        oldPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      setSuccessMsg('Đổi mật khẩu thành công!');
      setErrorMsg('');
      reset();
      setTimeout(() => setSuccessMsg(''), 5000);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      setErrorMsg(typeof message === 'string' ? message : 'Có lỗi xảy ra, vui lòng thử lại.');
      setSuccessMsg('');
    }
  });

  const onSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Hồ sơ Cá nhân" 
        breadcrumb={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Hồ sơ' }
        ]}
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Info Card */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="p-10 shadow-lg relative overflow-hidden text-center flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
            
            <div className="w-24 h-24 rounded-2xl bg-midnight/5 border border-gold/20 flex items-center justify-center mb-8 group overflow-hidden relative">
              <span className="text-4xl font-headline italic text-gold uppercase relative z-10">{profileData?.fullName?.charAt(0) || user?.fullName?.charAt(0) || 'U'}</span>
              <div className="absolute inset-0 bg-gold/5 group-hover:scale-110 transition-transform duration-500" />
            </div>

            <h3 className="text-3xl font-headline italic text-midnight mb-2">{profileData?.fullName || user?.fullName}</h3>
            <p className="text-xs font-label uppercase tracking-ultra text-midnight/40 mb-6">{profileData?.email || user?.email}</p>
            
            <div className="flex flex-wrap justify-center gap-3">
              {(profileData?.roles || user?.roles || []).map((role: string) => (
                <span key={role} className="px-3 py-1 bg-gold/5 text-gold border border-gold/10 rounded-full text-[9px] font-bold uppercase tracking-widest">
                  {role}
                </span>
              ))}
            </div>

            <div className="w-full mt-10 pt-10 border-t border-black/5 space-y-6">
              <div className="flex justify-between items-center font-label uppercase text-[10px] tracking-widest">
                <span className="text-midnight/40 text-left pr-4">Trạng thái</span>
                <span className="text-success font-bold bg-success-bg px-3 py-1 rounded-full border border-success/10">Hoạt động</span>
              </div>
              <div className="flex justify-between items-center font-label uppercase text-[10px] tracking-widest">
                <span className="text-midnight/40 text-left pr-4">Ngày tham gia</span>
                <span className="text-midnight/80 font-medium">
                  {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Settings / Security Section */}
        <div className="lg:col-span-2">
          <Card className="p-10 shadow-md">
            <h4 className="text-2xl font-headline italic text-gold mb-12">Bảo mật hệ thống</h4>

            {successMsg && (
              <div className="mb-8 p-4 bg-success-bg text-success border border-success/10 rounded-xl text-xs font-medium uppercase tracking-wider flex items-center gap-3">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="mb-8 p-4 bg-error-bg text-error border border-error/10 rounded-xl text-xs font-medium uppercase tracking-wider flex items-center gap-3">
                <span className="material-symbols-outlined text-sm">error</span>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-xl">
              <PasswordInput
                label="Mật khẩu hiện tại"
                placeholder="Nhập mật khẩu đang sử dụng"
                autoComplete="current-password"
                error={errors.currentPassword?.message}
                {...register('currentPassword')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PasswordInput
                  label="Mật khẩu mới"
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                  error={errors.newPassword?.message}
                  {...register('newPassword')}
                />
                <PasswordInput
                  label="Xác nhận mật khẩu mới"
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>

              <div className="pt-6">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-12"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
