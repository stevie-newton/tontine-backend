"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthCodeField from "@/components/AuthCodeField";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import AuthPhoneField from "@/components/AuthPhoneField";
import { useI18n } from "@/lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function VerifyPhoneForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/verify-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const txt = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(txt);
          throw new Error(j?.detail ? String(j.detail) : txt);
        } catch {
          throw new Error(txt);
        }
      }

      setInfo(t("verify_phone.verified"));
      setTimeout(() => router.push("/login"), 800);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setErr(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const txt = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(txt);
          throw new Error(j?.detail ? String(j.detail) : txt);
        } catch {
          throw new Error(txt);
        }
      }
      const data = txt ? JSON.parse(txt) : {};
      setInfo(String(data?.message || t("verify_phone.resent")));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-transparent flex items-center justify-center p-6">
      <AuthLocaleToggle />
      <section className="w-full max-w-md rounded-3xl border border-[rgba(79,107,194,0.16)] bg-white/84 p-8 shadow-[0_24px_70px_rgba(44,102,215,0.12)] backdrop-blur-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--brand-ink)]">{t("verify_phone.title")}</h1>
        <p className="mt-1 text-[color:var(--brand-muted)]">{t("verify_phone.subtitle")}</p>

        {err && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {err}
          </div>
        )}
        {info && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {info}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={verifyPhone}>
          <AuthPhoneField
            label={t("common.phone")}
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
            required
          />

          <AuthCodeField
            label={t("verify_phone.code_label")}
            value={code}
            onChange={setCode}
            placeholder={t("verify_phone.code_placeholder")}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] py-3 font-medium text-white shadow-[0_16px_35px_rgba(44,102,215,0.22)] hover:brightness-105 disabled:opacity-60"
          >
            {loading ? t("verify_phone.verifying") : t("verify_phone.verify")}
          </button>

          <button
            type="button"
            onClick={resendOtp}
            disabled={resending}
            className="w-full rounded-2xl border border-[rgba(79,107,194,0.24)] bg-white/88 py-3 text-sm font-medium text-[color:var(--brand-ink)] hover:bg-[rgba(46,207,227,0.08)] disabled:opacity-60"
          >
            {resending ? t("verify_phone.resending") : t("verify_phone.resend")}
          </button>
        </form>
      </section>
    </main>
  );
}
