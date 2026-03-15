"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";
import BrandLogo from "@/src/components/BrandLogo";

export default function AppHeader() {
  const router = useRouter();
  const { me, loading, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(79,107,194,0.16)] bg-white/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/tontines")}
          className="flex items-center gap-2 rounded-2xl px-2 py-1 transition hover:bg-[rgba(46,207,227,0.08)]"
          aria-label={t("header.go_to_tontines")}
        >
          <BrandLogo width={260} height={180} className="max-w-[120px] h-auto" />
          <div className="leading-tight text-left">
            <div className="bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] bg-clip-text text-sm font-semibold text-transparent">
              Cercora
            </div>
            <div className="text-xs text-[color:var(--brand-muted)]">{t("header.dashboard")}</div>
          </div>
        </button>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 max-sm:w-full">
          <div className="rounded-2xl border border-[rgba(79,107,194,0.16)] bg-white/80 p-1" aria-label={t("header.language")}>
            <button
              onClick={() => setLocale("en")}
              className={`rounded-xl px-2 py-1 text-xs font-medium ${locale === "en" ? "bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] text-white" : "text-[color:var(--brand-muted)]"}`}
              type="button"
            >
              {t("header.lang_en")}
            </button>
            <button
              onClick={() => setLocale("fr")}
              className={`rounded-xl px-2 py-1 text-xs font-medium ${locale === "fr" ? "bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] text-white" : "text-[color:var(--brand-muted)]"}`}
              type="button"
            >
              {t("header.lang_fr")}
            </button>
          </div>

          {!loading && me && (
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-[color:var(--brand-ink)]">{me.name}</div>
              <div className="text-xs text-[color:var(--brand-muted)]">{me.phone}</div>
            </div>
          )}

          {!loading && me?.is_global_admin && (
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="rounded-2xl border border-[rgba(79,107,194,0.24)] bg-white/85 px-3 py-2 text-xs font-semibold text-[color:var(--brand-ink)] transition hover:bg-[rgba(46,207,227,0.08)]"
              type="button"
            >
              {t("header.admin")}
            </button>
          )}

          <button
            onClick={() => router.push("/support")}
            className="rounded-2xl border border-[rgba(79,107,194,0.24)] bg-white/85 px-3 py-2 text-xs font-semibold text-[color:var(--brand-ink)] transition hover:bg-[rgba(46,207,227,0.08)]"
            type="button"
          >
            {t("header.support")}
          </button>

          <Link
            href="/privacy-policy"
            className="rounded-2xl border border-[rgba(79,107,194,0.24)] bg-white/85 px-3 py-2 text-xs font-semibold text-[color:var(--brand-ink)] transition hover:bg-[rgba(46,207,227,0.08)]"
          >
            {t("common.privacy_policy")}
          </Link>

          <button
            onClick={logout}
            disabled={loading}
            className="rounded-2xl bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_30px_rgba(44,102,215,0.22)] transition hover:brightness-105 disabled:opacity-60"
          >
            {t("header.logout")}
          </button>
        </div>

      </div>
    </header>
  );
}
