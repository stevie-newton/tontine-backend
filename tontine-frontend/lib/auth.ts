// src/lib/auth.ts
import { apiFetch } from "@/lib/api";

export type Me = {
  id: number;
  name: string;
  phone: string;
  is_phone_verified?: boolean;
  is_global_admin?: boolean;
};

export async function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}
