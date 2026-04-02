"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, Me } from "@/lib/auth";

function useAuthState(redirectOnMissing: boolean) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function checkAuth() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        if (redirectOnMissing) {
          router.replace("/login");
        }
        if (alive) setLoading(false);
        return;
      }

      try {
        const user = await fetchMe();
        if (alive) setMe(user);
      } catch {
        // token invalid/expired: clear and optionally redirect
        localStorage.removeItem("access_token");
        if (redirectOnMissing) {
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    checkAuth();
    return () => {
      alive = false;
    };
  }, [redirectOnMissing, router]);

  function logout() {
    localStorage.removeItem("access_token");
    router.replace("/login");
  }

  return { me, loading, logout };
}

export function useAuthGuard() {
  return useAuthState(true);
}

export function useOptionalAuth() {
  return useAuthState(false);
}

// Backward-compatible alias for shared UI that should not force redirects.
export const useAuth = useOptionalAuth;
