"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function AuthLocaleToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
      <Link
        href="/privacy-policy"
        className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
      >
        {t("common.privacy_policy")}
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-xl px-2 py-1 text-xs font-medium ${locale === "en" ? "bg-slate-900 text-white" : "text-slate-700"}`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale("fr")}
          className={`rounded-xl px-2 py-1 text-xs font-medium ${locale === "fr" ? "bg-slate-900 text-white" : "text-slate-700"}`}
        >
          FR
        </button>
      </div>
    </div>
  );
}
