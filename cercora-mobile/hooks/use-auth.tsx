import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  disableBiometricCredentials,
  getBiometricCredentials,
  getBiometricErrorMessage,
  getBiometricStatus,
  saveBiometricCredentials,
} from "@/hooks/biometric-auth";
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

type BiometricState = {
  isLoading: boolean;
  isAvailable: boolean;
  isEnabled: boolean;
  label: string;
};

type AuthContextValue = AuthState & {
  biometric: BiometricState;
  signIn: (args: { phone: string; password: string }) => Promise<void>;
  signInWithBiometrics: () => Promise<void>;
  enableBiometricSignIn: (args: { phone: string; password: string }) => Promise<void>;
  disableBiometricSignIn: () => Promise<void>;
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
  const [biometric, setBiometric] = useState<BiometricState>({
    isLoading: true,
    isAvailable: false,
    isEnabled: false,
    label: "Face ID",
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
    let isMounted = true;

    async function restoreBiometricState() {
      try {
        const status = await getBiometricStatus();
        if (!isMounted) return;
        setBiometric({ isLoading: false, ...status });
      } catch {
        if (!isMounted) return;
        setBiometric({
          isLoading: false,
          isAvailable: false,
          isEnabled: false,
          label: "Face ID",
        });
      }
    }

    void restoreBiometricState();
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

    async function refreshBiometricState() {
      const status = await getBiometricStatus();
      setBiometric({ isLoading: false, ...status });
    }

    async function requestSignIn(args: { phone: string; password: string }) {
      const body = `username=${encodeURIComponent(args.phone)}&password=${encodeURIComponent(args.password)}`;

      const res = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const accessToken = res.data?.access_token as string | undefined;
      const user = res.data?.user as User | undefined;
      if (!accessToken || !user) throw new Error("Unexpected login response");

      await persist({ accessToken, user });
    }

    return {
      ...state,
      biometric,
      async signIn({ phone, password }) {
        try {
          await requestSignIn({ phone, password });
        } catch (err) {
          throw new Error(getErrorMessage(err));
        }
      },
      async signInWithBiometrics() {
        try {
          const credentials = await getBiometricCredentials();
          if (!credentials) {
            throw new Error(`${biometric.label} is not set up on this device.`);
          }

          await requestSignIn(credentials);
        } catch (err) {
          const status = (err as { response?: { status?: number } } | null)?.response?.status;
          const message = getBiometricErrorMessage(err, biometric.label);
          const shouldReset = status === 401 || message === "Invalid phone or password";

          if (shouldReset) {
            await disableBiometricCredentials();
            await refreshBiometricState();
            throw new Error(
              `Saved ${biometric.label} credentials are no longer valid. Sign in with your password to enable it again.`
            );
          }

          throw new Error(message);
        }
      },
      async enableBiometricSignIn({ phone, password }) {
        try {
          await saveBiometricCredentials({ phone, password });
          await refreshBiometricState();
        } catch (err) {
          throw new Error(getBiometricErrorMessage(err, biometric.label));
        }
      },
      async disableBiometricSignIn() {
        try {
          await disableBiometricCredentials();
          await refreshBiometricState();
        } catch (err) {
          throw new Error(getBiometricErrorMessage(err, biometric.label));
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
  }, [biometric, router, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
