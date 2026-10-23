import { useCallback, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  Send,
  User,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { apiNetworkErrorMessage, isApiBaseConfigured, missingProductionApiUrlMessage } from '../../config/apiBase';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { DreamHighLogo } from '../../design-system/components/brand/DreamHighLogo';
import { cn } from '../../design-system/utils/cn';
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  type ForgotFormData,
  type LoginFormData,
  type RegisterFormData,
} from './authSchemas';

type AuthMode = 'login' | 'register' | 'forgot-password';

type LoginSuccessBody = {
  statusCode: number;
  data: {
    accessToken: string;
    user: {
      id: number;
      email: string;
      fullName: string;
      roles?: string[];
      userRoles?: { role?: { code: string } }[];
      [key: string]: unknown;
    };
  };
};

const googleClientIdConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const fieldClass =
  'w-full pl-11 pr-4 py-3 bg-bg border border-midnight/10 rounded-xl text-sm text-midnight placeholder:text-midnight/35 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all';

function IconField({
  icon: Icon,
  label,
  error,
  children,
}: {
  icon: LucideIcon;
  label?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <label className="ml-1 font-label text-[10px] font-bold uppercase tracking-widest text-midnight/40">
          {label}
        </label>
      ) : null}
      <div className="group relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-midnight/40 transition-colors group-focus-within:text-gold">
          <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </span>
        {children}
      </div>
      {error ? <p className="text-[10px] uppercase tracking-wider text-error">{error}</p> : null}
    </div>
  );
}

export interface AuthScreenProps {
  initialMode?: AuthMode;
}

export default function AuthScreen({ initialMode = 'login' }: AuthScreenProps) {
  const navigate = useNavigate();
  const setAuthData = useAuthStore((state) => state.login);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });
  const forgotForm = useForm<ForgotFormData>({ resolver: zodResolver(forgotSchema) });

  const applyLoginSuccess = useCallback(
    (resData: LoginSuccessBody) => {
      const u = resData.data.user;
      const rolesFromNested =
        u.userRoles?.map((ur) => ur.role?.code).filter((c): c is string => Boolean(c)) ?? [];
      const roles = u.roles && u.roles.length > 0 ? u.roles : rolesFromNested;
      const userRest = { ...u };
      delete userRest.userRoles;
      setAuthData({ ...userRest, roles }, resData.data.accessToken);
      navigate('/dashboard');
    },
    [navigate, setAuthData],
  );

  const handleApiError = useCallback((error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const msg = error.response?.data?.message;
      if (typeof msg === 'string' && msg.length > 0) {
        setErrorMsg(msg);
        return;
      }
      if (Array.isArray(error.response?.data?.message) && error.response.data.message[0]) {
        setErrorMsg(String(error.response.data.message[0]));
        return;
      }
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        setErrorMsg(apiNetworkErrorMessage());
        return;
      }
    }
    setErrorMsg(fallback);
  }, []);

  const guardApi = useCallback(() => {
    if (import.meta.env.PROD && !isApiBaseConfigured()) {
      setErrorMsg(missingProductionApiUrlMessage());
      return false;
    }
    return true;
  }, []);

  const onLoginSubmit = loginForm.handleSubmit(async (data) => {
    setErrorMsg('');
    if (!guardApi()) return;
    try {
      const response = await apiClient.post('/auth/login', data);
      const resData = response.data as LoginSuccessBody;
      if (resData.statusCode === 200) applyLoginSuccess(resData);
    } catch (e: unknown) {
      handleApiError(e, 'Đăng nhập thất bại. Vui lòng thử lại.');
    }
  });

  const onRegisterSubmit = registerForm.handleSubmit(async (data) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!guardApi()) return;
    try {
      await apiClient.post('/auth/register', {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      setSuccessMsg('Đăng ký thành công! Phân quyền: Học viên. Chuyển sang đăng nhập…');
      setTimeout(() => {
        setMode('login');
        setSuccessMsg('');
      }, 2200);
    } catch (e: unknown) {
      handleApiError(e, 'Đăng ký thất bại. Bạn vui lòng thử lại.');
    }
  });

  const onForgotSubmit = forgotForm.handleSubmit(() => {
    setErrorMsg('');
    setSuccessMsg(
      'Tính năng khôi phục mật khẩu qua email chưa kết nối backend. Vui lòng liên hệ quản trị viên hoặc đăng nhập bằng Google nếu đã liên kết tài khoản.',
    );
  });

  const onGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setErrorMsg('Google không trả về mã xác thực. Vui lòng thử lại.');
      return;
    }
    setErrorMsg('');
    if (!guardApi()) return;
    setGoogleBusy(true);
    try {
      const response = await apiClient.post('/auth/google', { idToken });
      const resData = response.data as LoginSuccessBody;
      if (resData.statusCode === 200) applyLoginSuccess(resData);
    } catch (e: unknown) {
      handleApiError(e, 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const panelClass = 'transition-opacity duration-300';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-bg p-4">
      <div
        className="pointer-events-none absolute left-0 top-0 h-64 w-64 -translate-x-1/4 -translate-y-1/4 rounded-full bg-gold/5 blur-3xl md:h-80 md:w-80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 translate-x-1/4 translate-y-1/4 rounded-full bg-midnight/5 blur-3xl md:h-80 md:w-80"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <Card className="overflow-hidden border border-midnight/5 bg-surface p-0 shadow-lg">
          <div className="border-b border-midnight/5 bg-bg/50 px-8 pb-8 pt-10 text-center md:px-10">
            <div className="mb-2 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <DreamHighLogo variant="onLight" heightClass="h-14 w-auto" className="max-w-[200px]" />
              <h1 className="font-headline text-2xl font-semibold uppercase tracking-wider text-midnight">
                Dream High
              </h1>
            </div>
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.4em] text-gold">
              Management System
            </p>
          </div>

          <div className="p-8 md:p-10">
            {errorMsg ? (
              <div className="mb-6 rounded-xl border border-error/15 bg-error-bg p-4 text-center font-label text-xs font-medium uppercase tracking-wider text-error">
                {errorMsg}
              </div>
            ) : null}
            {successMsg ? (
              <div className="mb-6 rounded-xl border border-success/15 bg-success-bg p-4 text-center font-label text-xs font-medium uppercase tracking-wider text-success">
                {successMsg}
              </div>
            ) : null}

            {mode === 'login' ? (
              <div key="login" className={panelClass}>
                <h2 className="mb-2 font-headline text-2xl text-midnight">Chào mừng trở lại!</h2>
                <p className="mb-8 font-body text-sm text-midnight/50">
                  Vui lòng đăng nhập để tiếp tục quản lý trung tâm.
                </p>

                {googleClientIdConfigured ? (
                  <div className="mb-8 flex flex-col items-center gap-3">
                    <p className="font-label text-[10px] uppercase tracking-widest text-midnight/40">
                      Đăng nhập nhanh
                    </p>
                    <div className={cn('flex justify-center', googleBusy && 'pointer-events-none opacity-60')}>
                      <GoogleLogin
                        onSuccess={(cr) => void onGoogleSuccess(cr)}
                        onError={() =>
                          setErrorMsg('Đăng nhập Google không hoàn tất. Vui lòng thử lại.')
                        }
                        useOneTap={false}
                        shape="rectangular"
                        size="large"
                        width="320"
                        locale="vi"
                        text="continue_with"
                      />
                    </div>
                    <div className="relative flex w-full items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-midnight/10" />
                      <span className="font-label text-[9px] uppercase tracking-widest text-midnight/30">
                        hoặc email
                      </span>
                      <span className="h-px flex-1 bg-midnight/10" />
                    </div>
                  </div>
                ) : null}

                <form onSubmit={onLoginSubmit} className="space-y-5">
                  <IconField
                    icon={User}
                    label="Email đăng nhập"
                    error={loginForm.formState.errors.email?.message}
                  >
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="admin@dreamhigh.edu.vn"
                      className={fieldClass}
                      {...loginForm.register('email')}
                    />
                  </IconField>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="font-label text-[10px] font-bold uppercase tracking-widest text-midnight/40">
                        Mật khẩu
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg('');
                          setSuccessMsg('');
                          setMode('forgot-password');
                        }}
                        className="font-label text-[10px] font-bold uppercase tracking-widest text-gold hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="group relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-midnight/40 transition-colors group-focus-within:text-gold">
                        <Lock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                      </span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="********"
                        className={fieldClass}
                        {...loginForm.register('password')}
                      />
                    </div>
                    {loginForm.formState.errors.password?.message ? (
                      <p className="text-[10px] uppercase tracking-wider text-error">
                        {loginForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    variant="dark"
                    disabled={loginForm.formState.isSubmitting}
                    className="flex w-full items-center justify-center gap-2 py-4 font-label text-xs font-bold uppercase tracking-widest"
                  >
                    {loginForm.formState.isSubmitting ? (
                      <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        Đăng nhập hệ thống
                        <ArrowRight className="size-4" aria-hidden />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-8 border-t border-midnight/5 pt-8 text-center">
                  <p className="font-body text-sm text-midnight/50">
                    Chưa có tài khoản?{' '}
                    <Link
                      to="/register"
                      className="font-bold text-gold hover:text-midnight hover:underline"
                    >
                      Đăng ký ngay
                    </Link>
                  </p>
                </div>
              </div>
            ) : null}

            {mode === 'register' ? (
              <div key="register" className={panelClass}>
                <h2 className="mb-2 font-headline text-2xl text-midnight">Tạo tài khoản mới</h2>
                <p className="mb-8 font-body text-sm text-midnight/50">
                  Đăng ký để trở thành học viên DreamHigh.
                </p>

                <form onSubmit={onRegisterSubmit} className="space-y-4">
                  <IconField
                    icon={User}
                    label="Họ và tên"
                    error={registerForm.formState.errors.fullName?.message}
                  >
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      className={fieldClass}
                      {...registerForm.register('fullName')}
                    />
                  </IconField>

                  <IconField
                    icon={Mail}
                    label="Email"
                    error={registerForm.formState.errors.email?.message}
                  >
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="email@dreamhigh.edu.vn"
                      className={fieldClass}
                      {...registerForm.register('email')}
                    />
                  </IconField>

                  <IconField
                    icon={Lock}
                    label="Mật khẩu"
                    error={registerForm.formState.errors.password?.message}
                  >
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự"
                      className={fieldClass}
                      {...registerForm.register('password')}
                    />
                  </IconField>

                  <IconField
                    icon={Lock}
                    label="Xác nhận mật khẩu"
                    error={registerForm.formState.errors.confirmPassword?.message}
                  >
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="********"
                      className={fieldClass}
                      {...registerForm.register('confirmPassword')}
                    />
                  </IconField>

                  <Button
                    type="submit"
                    disabled={registerForm.formState.isSubmitting}
                    className="mt-4 flex w-full items-center justify-center gap-2 py-4 font-label text-xs font-bold uppercase tracking-widest shadow-md shadow-gold/20"
                  >
                    {registerForm.formState.isSubmitting ? (
                      <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        Đăng ký học viên
                        <UserPlus className="size-4" aria-hidden />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-8 border-t border-midnight/5 pt-8 text-center">
                  <p className="font-body text-sm text-midnight/50">
                    Đã có tài khoản?{' '}
                    <Link
                      to="/login"
                      className="font-bold text-midnight hover:text-gold hover:underline"
                    >
                      Đăng nhập
                    </Link>
                  </p>
                </div>
              </div>
            ) : null}

            {mode === 'forgot-password' ? (
              <div key="forgot" className={panelClass}>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setMode('login');
                  }}
                  className="mb-6 flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-widest text-midnight/40 transition-colors hover:text-gold"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Quay lại đăng nhập
                </button>

                <h2 className="mb-2 font-headline text-2xl text-midnight">Khôi phục mật khẩu</h2>
                <p className="mb-8 font-body text-sm text-midnight/50">
                  Nhập email của bạn. Hệ thống sẽ hiển thị hướng dẫn tạm thời cho đến khi có API gửi email.
                </p>

                <form onSubmit={onForgotSubmit} className="space-y-6">
                  <IconField
                    icon={Mail}
                    label="Email đăng ký"
                    error={forgotForm.formState.errors.email?.message}
                  >
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="email@dreamhigh.edu.vn"
                      className={fieldClass}
                      {...forgotForm.register('email')}
                    />
                  </IconField>

                  <Button
                    type="submit"
                    variant="dark"
                    className="flex w-full items-center justify-center gap-2 py-4 font-label text-xs font-bold uppercase tracking-widest"
                  >
                    Gửi hướng dẫn
                    <Send className="size-4" aria-hidden />
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        </Card>

        <p className="mt-8 text-center font-label text-[10px] font-bold uppercase tracking-[0.2em] text-midnight/35">
          DreamHigh English Management System
        </p>
      </div>
    </div>
  );
}
