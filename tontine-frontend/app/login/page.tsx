"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import AuthPasswordField from "@/components/AuthPasswordField";
import AuthPhoneField from "@/components/AuthPhoneField";
import BrandLogo from "@/src/components/BrandLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.set("username", phone);
      body.set("password", password);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!res.ok) {
        let msg = await res.text();
        try {
          const j = JSON.parse(msg);
          msg = j?.detail ? String(j.detail) : msg;
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      router.push("/tontines");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-transparent flex items-center justify-center p-6">
      <AuthLocaleToggle />
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">
        <section className="hidden lg:flex flex-col justify-between rounded-3xl p-10 text-white shadow-[0_30px_80px_rgba(44,102,215,0.22)] bg-[linear-gradient(160deg,#102448_0%,#1e4ebc_40%,#7e35c2_100%)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("login.brand_secure")}
            </div>

            <h1 className="mt-4 text-4xl font-semibold leading-tight">{t("login.brand_title")}</h1>

            <p className="mt-4 text-white/80">{t("login.brand_subtitle")}</p>
          </div>

          <div className="text-sm text-white/70">{t("login.brand_tip")}</div>
        </section>

        <section className="rounded-3xl border border-[rgba(79,107,194,0.16)] bg-white/84 p-8 shadow-[0_24px_70px_rgba(44,102,215,0.12)] backdrop-blur-sm sm:p-10">
          <div className="mb-6 rounded-3xl bg-[linear-gradient(145deg,rgba(16,36,72,0.96)_0%,rgba(30,78,188,0.92)_42%,rgba(126,53,194,0.92)_100%)] p-5 text-white shadow-[0_18px_40px_rgba(44,102,215,0.18)] lg:hidden">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("login.brand_secure")}
            </div>
            <div className="mt-4">
              <BrandLogo width={260} height={180} className="h-auto max-w-[150px]" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight">{t("login.brand_title")}</h1>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--brand-ink)]">{t("login.welcome")}</h2>
              <p className="mt-1 text-[color:var(--brand-muted)]">{t("login.subtitle")}</p>
            </div>

            <BrandLogo width={260} height={180} className="h-auto max-w-[140px] self-start sm:max-w-[180px] sm:self-auto" />
          </div>

          {err && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
              <div className="font-medium">{t("login.failed")}</div>
              <div className="text-sm mt-1 whitespace-pre-wrap">{err}</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <AuthPhoneField
                label={t("common.phone")}
                value={phone}
                onChange={setPhone}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <AuthPasswordField
                label={t("common.password")}
                value={password}
                onChange={setPassword}
                placeholder={t("login.placeholder_password")}
                autoComplete="current-password"
                required
              />
              <div className="mt-2 text-right">
                <a href="/forgot-password" className="text-sm font-medium text-[color:var(--brand-blue)] hover:underline">
                  {t("login.forgot_password")}
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] py-3 font-medium text-white shadow-[0_16px_35px_rgba(44,102,215,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("login.signing_in") : t("login.sign_in")}
            </button>

            <div className="text-center text-sm text-[color:var(--brand-muted)]">
              {t("login.no_account")}{" "}
              <a href="/register" className="font-medium text-[color:var(--brand-blue)] hover:underline">
                {t("login.create_one")}
              </a>
            </div>

            <div className="text-center text-xs text-[color:var(--brand-muted)]">
              <a href="/privacy-policy" className="font-medium text-[color:var(--brand-blue)] hover:underline">
                {t("common.privacy_policy")}
              </a>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
