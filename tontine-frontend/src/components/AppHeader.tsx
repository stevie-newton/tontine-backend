"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";
import BrandLogo from "@/src/components/BrandLogo";

export default function AppHeader() {
  const router = useRouter();
  const { me, loading, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/tontines")}
          className="flex items-center gap-2 rounded-2xl px-2 py-1 transition hover:bg-slate-100"
          aria-label={t("header.go_to_tontines")}
        >
          <BrandLogo width={260} height={180} className="max-w-[120px] h-auto" />
          <div className="leading-tight text-left">
            <div className="text-sm font-semibold text-slate-900">Tontine</div>
            <div className="text-xs text-slate-500">{t("header.dashboard")}</div>
          </div>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-1" aria-label={t("header.language")}>
            <button
              onClick={() => setLocale("en")}
              className={`rounded-xl px-2 py-1 text-xs font-medium ${locale === "en" ? "bg-slate-900 text-white" : "text-slate-700"}`}
              type="button"
            >
              {t("header.lang_en")}
            </button>
            <button
              onClick={() => setLocale("fr")}
              className={`rounded-xl px-2 py-1 text-xs font-medium ${locale === "fr" ? "bg-slate-900 text-white" : "text-slate-700"}`}
              type="button"
            >
              {t("header.lang_fr")}
            </button>
          </div>

          {!loading && me && (
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900">{me.name}</div>
              <div className="text-xs text-slate-500">{me.phone}</div>
            </div>
          )}

          {!loading && me?.is_global_admin && (
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
              type="button"
            >
              {t("header.admin")}
            </button>
          )}

          <button
            onClick={() => router.push("/support")}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
            type="button"
          >
            {t("header.support")}
          </button>

          <button
            onClick={logout}
            disabled={loading}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-60"
          >
            {t("header.logout")}
          </button>
        </div>

      </div>
    </header>
  );
}
