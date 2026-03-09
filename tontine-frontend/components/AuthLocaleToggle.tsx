"use client";

import { useI18n } from "@/lib/i18n";

export default function AuthLocaleToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="absolute right-4 top-4 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur">
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
  );
}
