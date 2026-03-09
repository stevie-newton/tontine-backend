"use client";

import PageShell from "@/components/PageShell";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";

type AdminOverview = {
  users: {
    total: number;
    new_last_7_days: number;
    new_last_30_days: number;
    global_admins: number;
  };
  tontines: {
    total: number;
    by_status: { draft: number; active: number; completed: number };
    created_last_7_days: number;
    created_last_30_days: number;
  };
  financial: {
    contributions_last_30_days: number;
    contribution_volume_last_30_days: number;
    payout_volume_last_30_days: number;
    open_debts_count: number;
    open_debts_amount: number;
    repaid_debts_count: number;
    repaid_debts_amount: number;
  };
  risk: {
    cycles_blocked_count: number;
    members_with_open_debt: number;
    repeated_defaulters: number;
  };
};

type ReminderTarget = {
  membership_id: number;
  user_id: number;
  name: string;
  phone: string;
};

type ReminderCycle = {
  cycle_id: number;
  tontine_id: number;
  tontine_name: string;
  cycle_number: number;
  deadline: string;
  targets_count: number;
  targets: ReminderTarget[];
};

type ReminderPreview = {
  window_start: string;
  window_end: string;
  lookahead_hours: number;
  cycles_count: number;
  targets_count: number;
  cycles: ReminderCycle[];
};

type ReminderSendResult = {
  sms_configured: boolean;
  cycles_checked: number;
  cycles_marked: number;
  sms_sent: number;
  sms_failed: number;
};

export default function AdminDashboardPage() {
  const { me, loading: authLoading } = useAuthGuard();
  const { locale, t } = useI18n();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reminderPreview, setReminderPreview] = useState<ReminderPreview | null>(null);
  const [reminderResult, setReminderResult] = useState<ReminderSendResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency: "XAF",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!me?.is_global_admin) return;
    apiFetch<AdminOverview>("/admin/stats/overview")
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [authLoading, me?.is_global_admin]);

  async function previewReminders() {
    setPreviewLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<ReminderPreview>("/admin/stats/reminders/pre-deadline/preview");
      setReminderPreview(res);
    } catch (e) {
      setErr(String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendRemindersNow() {
    setSendLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<ReminderSendResult>("/admin/stats/reminders/pre-deadline/send", { method: "POST" });
      setReminderResult(res);
      await previewReminders();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSendLoading(false);
    }
  }

  if (authLoading) {
    return <PageShell title={t("admin.title")}>{t("common.loading")}</PageShell>;
  }

  if (!me?.is_global_admin) {
    return (
      <PageShell title={t("admin.title")}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t("admin.access_denied")}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("admin.title")} subtitle={t("admin.subtitle")}>
      {err && <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</pre>}
      {!data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{t("common.loading")}</div>
      ) : (
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("admin.users")}</h2>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>{t("admin.total_users", { value: data.users.total })}</div>
              <div>{t("admin.global_admins", { value: data.users.global_admins })}</div>
              <div>{t("admin.new_users_7", { value: data.users.new_last_7_days })}</div>
              <div>{t("admin.new_users_30", { value: data.users.new_last_30_days })}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("admin.tontines")}</h2>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>{t("admin.total_tontines", { value: data.tontines.total })}</div>
              <div>{t("admin.active_tontines", { value: data.tontines.by_status.active })}</div>
              <div>{t("admin.draft_tontines", { value: data.tontines.by_status.draft })}</div>
              <div>{t("admin.completed_tontines", { value: data.tontines.by_status.completed })}</div>
              <div>{t("admin.new_tontines_7", { value: data.tontines.created_last_7_days })}</div>
              <div>{t("admin.new_tontines_30", { value: data.tontines.created_last_30_days })}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("admin.financial")}</h2>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>{t("admin.contributions_30", { value: data.financial.contributions_last_30_days })}</div>
              <div>{t("admin.contrib_volume_30", { value: formatCurrency(data.financial.contribution_volume_last_30_days) })}</div>
              <div>{t("admin.payout_volume_30", { value: formatCurrency(data.financial.payout_volume_last_30_days) })}</div>
              <div>{t("admin.open_debts", { value: data.financial.open_debts_count })}</div>
              <div>{t("admin.open_debts_amount", { value: formatCurrency(data.financial.open_debts_amount) })}</div>
              <div>{t("admin.repaid_debts", { value: data.financial.repaid_debts_count })}</div>
              <div>{t("admin.repaid_debts_amount", { value: formatCurrency(data.financial.repaid_debts_amount) })}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("admin.risk")}</h2>
            <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>{t("admin.cycles_blocked", { value: data.risk.cycles_blocked_count })}</div>
              <div>{t("admin.open_debt_members", { value: data.risk.members_with_open_debt })}</div>
              <div>{t("admin.repeated_defaulters", { value: data.risk.repeated_defaulters })}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("admin.reminders_title")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("admin.reminders_subtitle")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={previewReminders}
                disabled={previewLoading || sendLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
              >
                {previewLoading ? t("admin.reminders_preview_loading") : t("admin.reminders_preview")}
              </button>
              <button
                type="button"
                onClick={sendRemindersNow}
                disabled={previewLoading || sendLoading}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {sendLoading ? t("admin.reminders_send_loading") : t("admin.reminders_send")}
              </button>
            </div>

            {reminderResult && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div>{t("admin.reminders_sms_configured", { value: String(reminderResult.sms_configured) })}</div>
                <div>{t("admin.reminders_cycles_checked", { value: reminderResult.cycles_checked })}</div>
                <div>{t("admin.reminders_cycles_marked", { value: reminderResult.cycles_marked })}</div>
                <div>{t("admin.reminders_sms_sent", { value: reminderResult.sms_sent })}</div>
                <div>{t("admin.reminders_sms_failed", { value: reminderResult.sms_failed })}</div>
              </div>
            )}

            {reminderPreview && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div>{t("admin.reminders_window", { start: new Date(reminderPreview.window_start).toLocaleString(), end: new Date(reminderPreview.window_end).toLocaleString() })}</div>
                  <div>{t("admin.reminders_cycles_count", { value: reminderPreview.cycles_count })}</div>
                  <div>{t("admin.reminders_targets_count", { value: reminderPreview.targets_count })}</div>
                </div>
                {reminderPreview.cycles.map((cycle) => (
                  <div key={cycle.cycle_id} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">
                      {t("admin.reminders_cycle_line", {
                        name: cycle.tontine_name,
                        number: cycle.cycle_number,
                        deadline: new Date(cycle.deadline).toLocaleString(),
                        count: cycle.targets_count,
                      })}
                    </div>
                    {cycle.targets_count === 0 ? (
                      <div className="mt-2 text-sm text-slate-600">{t("admin.reminders_no_targets")}</div>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {cycle.targets.map((target) => (
                          <li key={target.membership_id}>
                            {target.name} ({target.phone})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
