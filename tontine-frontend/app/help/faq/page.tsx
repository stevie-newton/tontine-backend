"use client";

import PageShell from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";

const FAQ_KEYS = [
  {
    q: "faq.q.create_tontine",
    a: "faq.a.create_tontine",
  },
  {
    q: "faq.q.confirm_payment",
    a: "faq.a.confirm_payment",
  },
  {
    q: "faq.q.missed_payment",
    a: "faq.a.missed_payment",
  },
  {
    q: "faq.q.leave_tontine",
    a: "faq.a.leave_tontine",
  },
];

export default function FAQPage() {
  const { t } = useI18n();

  return (
    <PageShell title={t("faq.title")} subtitle={t("faq.subtitle")}>
      <div className="space-y-3">
        {FAQ_KEYS.map((item) => (
          <section key={item.q} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t(item.q)}</h2>
            <p className="mt-2 text-sm text-slate-700">{t(item.a)}</p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
