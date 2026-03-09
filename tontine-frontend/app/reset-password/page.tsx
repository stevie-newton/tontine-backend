"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";

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
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <AuthLocaleToggle />
      <section className="w-full max-w-lg rounded-3xl bg-white shadow-xl border border-slate-100 p-8 sm:p-10">
        <h1 className="text-2xl font-semibold text-slate-900">{t("reset.title")}</h1>
        <p className="mt-1 text-slate-600">{t("reset.subtitle")}</p>

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
            <label className="text-sm font-medium text-slate-700">{t("common.phone")}</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
              placeholder={t("login.placeholder_phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">{t("common.phone_format_hint")}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">{t("reset.code")}</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
              placeholder={t("reset.placeholder_code")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">{t("reset.new_password")}</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
              placeholder={t("reset.placeholder_password")}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 text-white py-3 font-medium shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? t("reset.resetting") : t("reset.button")}
          </button>

          <div className="text-sm text-center text-slate-600">
            {t("reset.no_code")}{" "}
            <a href="/forgot-password" className="font-medium text-slate-900 hover:underline">
              {t("reset.request_again")}
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
