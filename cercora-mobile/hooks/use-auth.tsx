import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { subscribeToSessionExpired } from "@/hooks/auth-session";
import { api, setApiAccessToken } from "@/hooks/api-client";
import { getErrorMessage } from "@/hooks/error-utils";

type User = {
  id: number;
  name: string;
  phone: string;
  preferred_language: string;
  is_phone_verified: boolean;
  is_global_admin: boolean;
  created_at: string;
};

type AuthState = {
  isLoading: boolean;
  accessToken: string | null;
  user: User | null;
};

type AuthContextValue = AuthState & {
  signIn: (args: { phone: string; password: string }) => Promise<void>;
  signUp: (args: { name: string; phone: string; password: string }) => Promise<void>;
  verifyPhone: (args: { phone: string; code: string }) => Promise<void>;
  resendOtp: (args: { phone: string }) => Promise<void>;
  forgotPassword: (args: { phone: string }) => Promise<void>;
  resetPassword: (args: { phone: string; code: string; newPassword: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const ACCESS_TOKEN_KEY = "auth.accessToken";
const USER_KEY = "auth.user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const [state, setState] = useState<AuthState>({
    isLoading: true,
    accessToken: null,
    user: null,
  });

  useEffect(() => {
    let isMounted = true;
    async function restore() {
      try {
        const [token, userJson] = await Promise.all([
          AsyncStorage.getItem(ACCESS_TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        let user = userJson ? (JSON.parse(userJson) as User) : null;
        if (!isMounted) return;

        setApiAccessToken(token);

        if (token) {
          try {
            const me = await api.get<User>("/auth/me");
            user = me.data;
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
          } catch (err) {
            const status = (err as any)?.response?.status as number | undefined;
            if (status === 401) {
              setApiAccessToken(null);
              await Promise.all([
                AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
                AsyncStorage.removeItem(USER_KEY),
              ]);
              setState({ isLoading: false, accessToken: null, user: null });
              return;
            }
          }
        }

        setState({ isLoading: false, accessToken: token, user });
      } catch {
        if (!isMounted) return;
        setApiAccessToken(null);
        setState({ isLoading: false, accessToken: null, user: null });
      }
    }

    restore();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToSessionExpired(async () => {
      setApiAccessToken(null);
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
      setState({ isLoading: false, accessToken: null, user: null });
      router.replace("/(auth)/login");
    });
  }, [router]);

  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!state.accessToken && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }
    if (state.accessToken && inAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [router, segments, state.accessToken, state.isLoading]);

  const value = useMemo<AuthContextValue>(() => {
    async function persist(auth: { accessToken: string; user: User }) {
      setApiAccessToken(auth.accessToken);
      setState({ isLoading: false, accessToken: auth.accessToken, user: auth.user });
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(auth.user)),
      ]);
    }

    return {
      ...state,
      async signIn({ phone, password }) {
        try {
          const body = `username=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`;

          const res = await api.post("/auth/login", body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });

          const accessToken = res.data?.access_token as string | undefined;
          const user = res.data?.user as User | undefined;
          if (!accessToken || !user) throw new Error("Unexpected login response");

          await persist({ accessToken, user });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async signUp({ name, phone, password }) {
        try {
          await api.post("/auth/register", { name, phone, password });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async verifyPhone({ phone, code }) {
        try {
          await api.post("/auth/verify-phone", { phone, code });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async resendOtp({ phone }) {
        try {
          await api.post("/auth/resend-otp", { phone });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async forgotPassword({ phone }) {
        try {
          await api.post("/auth/forgot-password", { phone });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async resetPassword({ phone, code, newPassword }) {
        try {
          await api.post("/auth/reset-password", { phone, code, new_password: newPassword });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async signOut() {
        setApiAccessToken(null);
        setState({ isLoading: false, accessToken: null, user: null });
        await Promise.all([
          AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
          AsyncStorage.removeItem(USER_KEY),
        ]);
        router.replace("/(auth)/login");
      },
    };
  }, [router, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
