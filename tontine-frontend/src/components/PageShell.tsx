"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n";

export default function PageShell({
  title,
  subtitle,
  right,
  showBack = true,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="mb-4 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            {t("shell.back")}
          </button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
          </div>
          {right}
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
