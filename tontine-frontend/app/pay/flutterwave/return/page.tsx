"use client";

import PageShell from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";

export default function FlutterwaveReturnPage() {
  const { t } = useI18n();
  return (
    <PageShell title={t("payment_disabled.title")}>
      <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
        {t("payment_disabled.body")}
      </div>
    </PageShell>
  );
}
