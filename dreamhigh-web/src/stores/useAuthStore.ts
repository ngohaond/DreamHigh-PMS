import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type UserData = {
  id: number;
  email: string;
  fullName: string;
  roles?: string[];
  branchIds?: number[];
  phone?: string | null;
  username?: string;
  status?: string;
};

interface AuthState {
  user: UserData | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (userData: UserData, authToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (userData, authToken) =>
        set({
          user: userData,
          token: authToken,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'dreamhigh-auth-storage', // key in localStorage
      storage: createJSONStorage(() => localStorage), 
    }
  )
);
