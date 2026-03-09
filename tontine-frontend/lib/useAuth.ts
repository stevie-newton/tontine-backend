"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, Me } from "@/lib/auth";

export function useAuthGuard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function checkAuth() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const user = await fetchMe();
        if (alive) setMe(user);
      } catch {
        // token invalid/expired: clear and redirect
        localStorage.removeItem("access_token");
        router.replace("/login");
      } finally {
        if (alive) setLoading(false);
      }
    }

    checkAuth();
    return () => {
      alive = false;
    };
  }, [router]);

  function logout() {
    localStorage.removeItem("access_token");
    router.replace("/login");
  }

  return { me, loading, logout };
}

// Backward-compatible alias.
export const useAuth = useAuthGuard;
