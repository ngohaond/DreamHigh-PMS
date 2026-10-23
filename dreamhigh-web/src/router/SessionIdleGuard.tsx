import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'mousemove'] as const;

export function SessionIdleGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let timer = window.setTimeout(expireSession, IDLE_TIMEOUT_MS);
    function expireSession() {
      logout();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
    function resetTimer() {
      window.clearTimeout(timer);
      timer = window.setTimeout(expireSession, IDLE_TIMEOUT_MS);
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [isAuthenticated, logout, navigate, queryClient]);

  return children;
}