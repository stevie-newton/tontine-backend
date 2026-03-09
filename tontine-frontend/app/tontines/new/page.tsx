"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";

type CreateTontineResponse = {
  id: number;
};

export default function NewTontinePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { loading: authLoading } = useAuthGuard();

  const [name, setName] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");

  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreateTontine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setErr(null);
    try {
      const created = await apiFetch<CreateTontineResponse>("/tontines/", {
        method: "POST",
        body: JSON.stringify({
          name,
          contribution_amount: Number(contributionAmount),
          frequency,
          total_cycles: 1,
          current_cycle: 1,
          status: "draft",
        }),
      });
      router.push(`/tontines/${created.id}`);
    } catch (e2) {
      setErr(String(e2));
    } finally {
      setCreating(false);
    }
  }

  if (authLoading) {
    return <PageShell title={t("new_tontine.title")}>{t("common.loading")}</PageShell>;
  }

  return (
    <PageShell title={t("new_tontine.title")} subtitle={t("new_tontine.subtitle")}>
      <div className="max-w-xl">
        {err && <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</pre>}
        <form onSubmit={onCreateTontine} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            placeholder={t("new_tontine.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:ring"
          />
          <input
            placeholder={t("new_tontine.amount")}
            type="number"
            step="0.01"
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:ring"
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:ring"
          >
            <option value="weekly">{t("new_tontine.weekly")}</option>
            <option value="monthly">{t("new_tontine.monthly")}</option>
          </select>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {t("new_tontine.auto_cycles_hint")}
          </p>
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? t("new_tontine.creating") : t("new_tontine.create")}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
