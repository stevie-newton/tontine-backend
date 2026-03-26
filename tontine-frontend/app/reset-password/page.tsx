"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCodeField from "@/components/AuthCodeField";
import { useI18n } from "@/lib/i18n";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import AuthPasswordField from "@/components/AuthPasswordField";
import AuthPhoneField from "@/components/AuthPhoneField";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        let text = await res.text();
        try {
          const data = JSON.parse(text);
          text = data?.detail ? String(data.detail) : text;
        } catch {}
        throw new Error(text);
      }

      const data = await res.json();
      setMsg(data?.message ?? t("reset.success_message"));
      setTimeout(() => router.push("/login"), 1500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-transparent flex items-center justify-center p-6">
      <AuthLocaleToggle />
      <section className="w-full max-w-lg rounded-3xl border border-[rgba(79,107,194,0.16)] bg-white/84 p-8 shadow-[0_24px_70px_rgba(44,102,215,0.12)] backdrop-blur-sm sm:p-10">
        <h1 className="text-2xl font-semibold text-[color:var(--brand-ink)]">{t("reset.title")}</h1>
        <p className="mt-1 text-[color:var(--brand-muted)]">{t("reset.subtitle")}</p>

        {err && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <div className="font-medium">{t("reset.failed")}</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{err}</div>
          </div>
        )}

        {msg && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <div className="font-medium">{t("common.success")}</div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{msg}</div>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <AuthPhoneField
              label={t("common.phone")}
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
              required
            />
          </div>

          <div>
            <AuthCodeField
              label={t("reset.code")}
              value={code}
              onChange={setCode}
              placeholder={t("reset.placeholder_code")}
              required
            />
          </div>

          <div>
            <AuthPasswordField
              label={t("reset.new_password")}
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t("reset.placeholder_password")}
              autoComplete="new-password"
              required
              showStrength
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] py-3 font-medium text-white shadow-[0_16px_35px_rgba(44,102,215,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("reset.resetting") : t("reset.button")}
          </button>

          <div className="text-center text-sm text-[color:var(--brand-muted)]">
            {t("reset.no_code")}{" "}
            <a href="/forgot-password" className="font-medium text-[color:var(--brand-blue)] hover:underline">
              {t("reset.request_again")}
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
