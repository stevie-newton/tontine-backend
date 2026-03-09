"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import { useI18n } from "@/lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

function VerifyPhoneContent() {
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
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <AuthLocaleToggle />
      <section className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-100 p-8">
        <h1 className="text-2xl font-semibold text-slate-900">{t("verify_phone.title")}</h1>
        <p className="mt-1 text-slate-600">{t("verify_phone.subtitle")}</p>

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
          <div>
            <label className="text-sm font-medium text-slate-700">{t("common.phone")}</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">{t("verify_phone.code_label")}</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-4 focus:ring-slate-200 focus:border-slate-300"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("verify_phone.code_placeholder")}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 text-white py-3 font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? t("verify_phone.verifying") : t("verify_phone.verify")}
          </button>

          <button
            type="button"
            onClick={resendOtp}
            disabled={resending}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            {resending ? t("verify_phone.resending") : t("verify_phone.resend")}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={null}>
      <VerifyPhoneContent />
    </Suspense>
  );
}
