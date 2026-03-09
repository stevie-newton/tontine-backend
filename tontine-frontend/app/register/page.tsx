"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import BrandLogo from "@/src/components/BrandLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const regRes = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password }),
      });

      if (!regRes.ok) {
        let msg = await regRes.text();
        try {
          const j = JSON.parse(msg);
          msg = j?.detail ? String(j.detail) : msg;
        } catch {}
        throw new Error(msg);
      }

      router.push(`/verify?phone=${encodeURIComponent(phone)}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <AuthLocaleToggle />
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">
        <section className="hidden lg:flex flex-col justify-between rounded-3xl p-10 bg-slate-900 text-white shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              {t("register.badge")}
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-tight">{t("register.brand_title")}</h1>
            <p className="mt-4 text-white/80">{t("register.brand_subtitle")}</p>
          </div>

          <div className="text-sm text-white/70">
            {t("register.already_registered")}{" "}
            <a className="text-white underline" href="/login">
              {t("register.sign_in")}
            </a>
          </div>
        </section>

        <section className="rounded-3xl bg-white shadow-xl border border-slate-100 p-8 sm:p-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{t("register.title")}</h2>
              <p className="mt-1 text-slate-600">{t("register.subtitle")}</p>
            </div>

            <BrandLogo size={100} />
          </div>

          {err && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
              <div className="font-medium">{t("register.failed")}</div>
              <div className="text-sm mt-1 whitespace-pre-wrap">{err}</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">{t("register.full_name")}</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
                placeholder={t("register.placeholder_name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{t("common.phone")}</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
                placeholder={t("register.placeholder_phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-slate-500">{t("common.phone_format_hint")}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{t("common.password")}</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
                placeholder={t("register.placeholder_password")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 text-white py-3 font-medium shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? t("register.creating") : t("register.create_account")}
            </button>

            <div className="text-xs text-slate-500 text-center">{t("register.terms")}</div>
          </form>
        </section>
      </div>
    </main>
  );
}
