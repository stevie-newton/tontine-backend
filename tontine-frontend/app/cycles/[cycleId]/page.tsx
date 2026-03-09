"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuth";
import PageShell from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";

type Cycle = {
  id: number;
  tontine_id: number;
  cycle_number: number;
  is_closed: boolean;
  closed_at?: string | null;
  start_date?: string;
  end_date?: string;
  contribution_deadline?: string | null;
  grace_period_hours?: number;
  payout_member_id?: number | null;
  payout_member_name?: string | null;
};

type CycleContributionStatus = {
  cycle_id: number;
  tontine_id: number;
  deadline?: string;
  deadline_with_grace?: string;
  grace_period_hours?: number;
  expected_members: number;
  paid_count: number;
  on_time_count?: number;
  late_count?: number;
  missing_count: number;
  total_received: string;
  expected_total: string;
  is_fully_funded: boolean;
  paid_members: Array<{ membership_id: number; user_id: number; name: string }>;
  missing_members: Array<{ membership_id: number; user_id: number; name: string }>;
  member_statuses?: Array<{
    membership_id: number;
    user_id: number;
    name: string;
    phone?: string;
    status: "on_time" | "late" | "missing";
    paid_at?: string | null;
    amount?: string | null;
  }>;
};

type CycleContribution = {
  id: number;
  membership_id: number;
  user_id: number;
  user_name: string;
  user_phone: string;
  amount: string;
  transaction_reference?: string;
  proof_screenshot_url?: string | null;
  beneficiary_decision?: string;
  is_confirmed: boolean;
  ledger_entry_created?: boolean;
  paid_at: string;
};

type CycleContributionsResponse = {
  cycle_id: number;
  count: number;
  contributions: CycleContribution[];
};

type PayoutResponse = {
  id: number;
  tontine_id: number;
  cycle_id: number;
  membership_id: number;
  amount: string;
  is_processed: boolean;
  processed_at?: string | null;
  created_at?: string | null;
};

type Tontine = {
  id: number;
  owner_id: number;
  contribution_amount: string;
  name: string;
};

type MemberRow = {
  membership_id: number;
  id: number;
  name: string;
  phone: string;
  membership_role: string;
  membership_status: "active" | "pending";
  payout_position?: number | null;
  rotation_position?: number | null;
  joined_at: string;
};

type DebtRow = {
  id: number;
  cycle_id: number;
  debtor_membership_id: number;
  debtor_user_id: number;
  debtor_name: string;
  coverer_membership_id: number;
  coverer_user_id: number;
  coverer_name: string;
  amount: string;
  is_repaid: boolean;
  notes?: string | null;
};

type DebtListResponse = {
  tontine_id: number;
  count: number;
  debts: DebtRow[];
};

type TontineCycleStatusItem = {
  cycle_id: number;
  cycle_number: number;
  payout_processed: boolean;
  payout_amount?: string | null;
  payout_member_name?: string | null;
};

type TontineCycleStatusResponse = {
  tontine_id: number;
  total_cycles: number;
  cycles: TontineCycleStatusItem[];
};

export default function CyclePage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { locale, t } = useI18n();
  const { me, loading: authLoading } = useAuthGuard();
  const resolvedParams = use(params);
  const cycleId = Number(resolvedParams.cycleId);

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [status, setStatus] = useState<CycleContributionStatus | null>(null);
  const [contributions, setContributions] = useState<CycleContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("0.00");
  const [transactionReference, setTransactionReference] = useState("");
  const [proofScreenshotUrl, setProofScreenshotUrl] = useState("");
  const [payoutStatus, setPayoutStatus] = useState<TontineCycleStatusItem | null>(null);

  const [paying, setPaying] = useState(false);
  const [decidingContributionId, setDecidingContributionId] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [covering, setCovering] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [debtorMembershipId, setDebtorMembershipId] = useState<number | null>(null);
  const [covererMembershipId, setCovererMembershipId] = useState<number | null>(null);
  const [coverNotes, setCoverNotes] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [graceHoursInput, setGraceHoursInput] = useState("24");
  const isOwner = !!me && !!tontine && me.id === tontine.owner_id;
  const myMember = me ? members.find((m) => m.id === me.id) : null;
  const isAdmin = !!myMember && myMember.membership_role === "admin" && myMember.membership_status === "active";
  const canManageDebt = isOwner || isAdmin;
  const isCurrentBeneficiary = !!me && !!cycle && cycle.payout_member_id === me.id;
  const hasPaid = !!me && !!status?.paid_members?.some((m) => m.user_id === me.id);
  const myContribution = me ? contributions.find((c) => c.user_id === me.id) : null;
  const hasSubmitted = !!myContribution;
  const isClosed = !!cycle?.is_closed;
  const canClose = isOwner && !!status?.is_fully_funded && !isClosed;
  const paidNames = status?.paid_members?.map((m) => m.name) ?? [];
  const missingNames = status?.missing_members?.map((m) => m.name) ?? [];

  function getErrorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  function formatCurrency(value?: string | number | null): string {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0 XAF";
    return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency: "XAF",
      maximumFractionDigits: 0,
    }).format(n);
  }

  function formatDate(value?: string | null): string {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US");
  }

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const [cycleRes, statusRes, contributionsRes] = await Promise.all([
        apiFetch<Cycle>(`/tontine-cycles/${cycleId}`),
        apiFetch<CycleContributionStatus>(`/contributions/cycle/${cycleId}/status`),
        apiFetch<CycleContributionsResponse>(`/contributions/cycle/${cycleId}`),
      ]);
      const tontineRes = await apiFetch<Tontine>(`/tontines/${cycleRes.tontine_id}`);
      const membersRes = await apiFetch<MemberRow[]>(`/tontine-memberships/tontine/${cycleRes.tontine_id}/members`);
      const debtRes = await apiFetch<DebtListResponse>(`/debts/tontine/${cycleRes.tontine_id}`);
      const cycleStatusRes = await apiFetch<TontineCycleStatusResponse>(`/cycles/status/${cycleRes.tontine_id}`);
      const thisCycleStatus =
        cycleStatusRes.cycles.find((c) => c.cycle_id === cycleRes.id) ??
        cycleStatusRes.cycles.find((c) => c.cycle_number === cycleRes.cycle_number) ??
        null;

      setCycle(cycleRes);
      setTontine(tontineRes);
      setMembers(membersRes);
      setDebts(debtRes.debts);
      setStatus(statusRes);
      setContributions(contributionsRes.contributions);
      setPayAmount(tontineRes.contribution_amount);
      setPayoutStatus(thisCycleStatus);
      if (!deadlineInput) {
        const raw = cycleRes.contribution_deadline || cycleRes.end_date;
        if (raw) {
          const d = new Date(raw);
          if (!Number.isNaN(d.getTime())) {
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setDeadlineInput(local);
          }
        }
      }
      if (graceHoursInput === "24" && typeof cycleRes.grace_period_hours === "number") {
        setGraceHoursInput(String(cycleRes.grace_period_hours));
      }
      if (statusRes.missing_members.length && debtorMembershipId === null) {
        setDebtorMembershipId(statusRes.missing_members[0].membership_id);
      }
      if (membersRes.length && covererMembershipId === null) {
        const myself = me ? membersRes.find((m) => m.id === me.id) : null;
        setCovererMembershipId(myself?.membership_id ?? membersRes[0].membership_id);
      }
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onRecordCoverPayment() {
    if (!debtorMembershipId || !covererMembershipId) {
      setErr(t("cycle.select_both"));
      return;
    }
    setCovering(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/debts/cover-payment`, {
        method: "POST",
        body: JSON.stringify({
          cycle_id: cycleId,
          debtor_membership_id: debtorMembershipId,
          coverer_membership_id: covererMembershipId,
          amount: payAmount,
          notes: coverNotes.trim() || null,
        }),
      });
      setMsg(t("cycle.cover_saved"));
      setCoverNotes("");
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setCovering(false);
    }
  }

  async function onSendReminders() {
    setSendingReminders(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await apiFetch<{ count: number }>(`/contributions/cycle/${cycleId}/reminders/send`, {
        method: "POST",
        body: JSON.stringify({ channels: ["sms", "email", "push"] }),
      });
      setMsg(t("cycle.reminders_processed", { count: result.count }));
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setSendingReminders(false);
    }
  }

  async function onSaveDeadline() {
    if (!deadlineInput) {
      setErr(t("cycle.set_deadline_first"));
      return;
    }
    setSavingDeadline(true);
    setErr(null);
    setMsg(null);
    try {
      const iso = new Date(deadlineInput).toISOString();
      await apiFetch(`/tontine-cycles/${cycleId}/deadline`, {
        method: "PUT",
        body: JSON.stringify({
          contribution_deadline: iso,
          grace_period_hours: Number(graceHoursInput || "0"),
        }),
      });
      setMsg(t("cycle.deadline_updated"));
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setSavingDeadline(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(cycleId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function onPay() {
    setPaying(true);
    setErr(null);
    setMsg(null);

    try {
      await apiFetch(`/contributions/`, {
        method: "POST",
        body: JSON.stringify({
          cycle_id: cycleId,
          amount: payAmount,
          transaction_reference: transactionReference.trim(),
          proof_screenshot_url: proofScreenshotUrl.trim() || null,
        }),
      });
      setMsg(t("cycle.contribution_submitted"));
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
      setPaying(false);
      return;
    } finally {
      setPaying(false);
    }
  }

  async function onCloseCycle() {
    setClosing(true);
    setErr(null);
    setMsg(null);

    try {
      const payout = await apiFetch<PayoutResponse>(`/tontine-cycles/${cycleId}/close`, {
        method: "PUT",
      });

      setMsg(t("cycle.cycle_closed_payout", { id: payout.id }));
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setClosing(false);
    }
  }

  async function onBeneficiaryDecision(contributionId: number, decision: "confirm" | "reject") {
    setDecidingContributionId(contributionId);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/contributions/${contributionId}/beneficiary-confirmation`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMsg(
        decision === "confirm"
          ? t("cycle.beneficiary_confirmed")
          : t("cycle.beneficiary_rejected")
      );
      await load();
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setDecidingContributionId(null);
    }
  }

  if (authLoading) {
    return <PageShell title={t("cycle.title")}>{t("cycle.auth_loading")}</PageShell>;
  }

  return (
    <PageShell title={t("cycle.title")} subtitle={t("cycle.subtitle", { id: cycleId })}>
      <div className="max-w-4xl">
        <div
          className={[
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            isClosed
              ? "bg-red-100 text-red-800"
              : status?.is_fully_funded
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800",
          ].join(" ")}
        >
          {isClosed ? t("cycle.closed") : status?.is_fully_funded ? t("cycle.fully_funded") : t("cycle.open")}
        </div>

        {loading && <p className="mt-3 text-sm text-slate-600">{t("common.loading")}</p>}
        {err && <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</pre>}
        {msg && <p className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</p>}

        {cycle && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Cycle #{cycle.cycle_number}</h2>
            <div className="mt-2 text-sm text-slate-700">{t("tontines.id", { id: cycle.tontine_id })}</div>
            <div className="text-sm text-slate-700">
              {t("cycle.date_range", { start: formatDate(cycle.start_date), end: formatDate(cycle.end_date) })}
            </div>
            <div className="text-sm text-slate-700">{t("tontine_detail.closed", { value: String(cycle.is_closed) })}</div>
            <div className="text-sm text-slate-700">{t("cycle.payout_member", { name: cycle.payout_member_name ?? payoutStatus?.payout_member_name ?? "-" })}</div>
            <div className="text-sm text-slate-700">
              {t("cycle.payout", {
                status: payoutStatus?.payout_processed ? t("cycle.processed") : t("cycle.pending"),
                amount: payoutStatus?.payout_processed ? ` (${formatCurrency(payoutStatus.payout_amount)})` : "",
              })}
            </div>
          </section>
        )}

        {status && (
          <>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("cycle.funding")}</h2>
              <div className="mt-2 text-sm text-slate-700">
                {t("cycle.paid")}: <b>{status.paid_count}</b> / {status.expected_members}{" "}
                {status.is_fully_funded ? t("cycle.funded_yes") : t("cycle.funded_no")}
              </div>
              <div className="text-sm text-slate-700">
                {t("cycle.on_time")}: <b>{status.on_time_count ?? 0}</b> | {t("cycle.late")}: <b>{status.late_count ?? 0}</b> | {t("cycle.missing")}:{" "}
                <b>{status.missing_count}</b>
              </div>
              <div className="text-sm text-slate-700">{t("cycle.deadline", { value: formatDate(status.deadline) })}</div>
              <div className="text-sm text-slate-700">{t("cycle.grace_hours", { value: status.grace_period_hours ?? 0 })}</div>
              <div className="text-sm text-slate-700">{t("cycle.total_contributed", { value: formatCurrency(status.total_received) })}</div>
              <div className="text-sm text-slate-700">{t("cycle.expected_total", { value: formatCurrency(status.expected_total) })}</div>
            </section>

            <section className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{t("cycle.paid")}</h3>
                {paidNames.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                    {paidNames.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{t("cycle.no_payments")}</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{t("cycle.missing")}</h3>
                {missingNames.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                    {missingNames.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{t("cycle.no_missing")}</p>
                )}
              </div>
            </section>

            <section className="mt-4 flex flex-wrap gap-2">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{t("cycle.submit_contribution")}</h3>
                <div className="mt-2 grid gap-2">
                  <input
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    placeholder={t("cycle.transaction_ref")}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    disabled={paying || isClosed || hasSubmitted}
                  />
                  <p className="text-xs text-slate-500">{t("cycle.transaction_ref_hint")}</p>
                  <input
                    value={proofScreenshotUrl}
                    onChange={(e) => setProofScreenshotUrl(e.target.value)}
                    placeholder={t("cycle.screenshot_url")}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    disabled={paying || isClosed || hasSubmitted}
                  />
                  <button
                    onClick={onPay}
                    disabled={paying || isClosed || hasSubmitted || isCurrentBeneficiary || !transactionReference.trim()}
                    className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paying
                      ? t("cycle.submitting")
                      : isCurrentBeneficiary
                        ? t("cycle.beneficiary_exempt")
                        : hasSubmitted
                          ? t("cycle.already_submitted")
                          : t("cycle.submit_amount", { amount: formatCurrency(payAmount) })}
                  </button>
                </div>
                {isCurrentBeneficiary && (
                  <p className="mt-2 text-sm text-sky-800">{t("cycle.beneficiary_exempt_hint")}</p>
                )}
                {myContribution && (
                  <p className="mt-2 text-sm text-slate-700">
                    {t("cycle.your_status", {
                      status: myContribution.is_confirmed ? "confirmed" : myContribution.beneficiary_decision ?? "pending",
                    })}
                  </p>
                )}
                {!hasPaid && hasSubmitted && (
                  <p className="mt-1 text-sm text-amber-700">
                    {t("cycle.waiting_confirm")}
                  </p>
                )}
              </div>

              {isOwner && (
                <button
                  onClick={onCloseCycle}
                  disabled={closing || !canClose}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {closing ? t("cycle.closing") : t("cycle.close_cycle")}
                </button>
              )}
              {canManageDebt && (
                <button
                  onClick={onSendReminders}
                  disabled={sendingReminders}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingReminders ? t("cycle.sending_reminders") : t("cycle.send_reminders")}
                </button>
              )}
            </section>

            {isCurrentBeneficiary && (
              <section className="mt-4 w-full max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <h3 className="text-base font-semibold text-sky-900">{t("cycle.beneficiary_review_title")}</h3>
                <p className="mt-1 text-sm text-sky-800">{t("cycle.beneficiary_review_subtitle")}</p>
                <div className="mt-2 space-y-2">
                  {contributions
                    .filter((c) => !c.is_confirmed && (c.beneficiary_decision ?? "pending") === "pending")
                    .map((c) => (
                      <div key={c.id} className="rounded-xl border border-sky-200 bg-white p-3 text-sm text-slate-700">
                        <div>
                          <b>{c.user_name}</b> - {formatCurrency(c.amount)} - {c.transaction_reference || "-"}
                        </div>
                        {c.proof_screenshot_url && (
                          <div className="mt-1">
                            <a
                              href={c.proof_screenshot_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 underline"
                            >
                              {t("cycle.view_proof")}
                            </a>
                          </div>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => onBeneficiaryDecision(c.id, "confirm")}
                            disabled={decidingContributionId === c.id}
                            className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {decidingContributionId === c.id ? t("cycle.processing") : t("cycle.confirm_payment")}
                          </button>
                          <button
                            onClick={() => onBeneficiaryDecision(c.id, "reject")}
                            disabled={decidingContributionId === c.id}
                            className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {decidingContributionId === c.id ? t("cycle.processing") : t("cycle.reject_payment")}
                          </button>
                        </div>
                      </div>
                    ))}
                  {!contributions.some(
                    (c) => !c.is_confirmed && (c.beneficiary_decision ?? "pending") === "pending"
                  ) && <p className="text-sm text-sky-800">{t("cycle.no_pending_reviews")}</p>}
                </div>
              </section>
            )}

            {canManageDebt && !cycle?.is_closed && (
              <section className="mt-4 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{t("cycle.deadline_title")}</h3>
                <div className="mt-2 grid gap-2">
                  <input
                    type="datetime-local"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  <input
                    type="number"
                    min={0}
                    value={graceHoursInput}
                    onChange={(e) => setGraceHoursInput(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder={t("cycle.grace_placeholder")}
                  />
                  <button
                    onClick={onSaveDeadline}
                    disabled={savingDeadline || !deadlineInput}
                    className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDeadline ? t("cycle.saving") : t("cycle.save_deadline")}
                  </button>
                </div>
              </section>
            )}

            {canManageDebt && !cycle?.is_closed && (
              <section className="mt-4 w-full max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-base font-semibold text-amber-900">{t("cycle.cover_title")}</h3>
                <p className="mt-1 text-sm text-amber-800">
                  {t("cycle.cover_desc")}
                </p>
                <div className="mt-2 grid gap-2">
                  <select
                    value={debtorMembershipId ?? ""}
                    onChange={(e) => setDebtorMembershipId(Number(e.target.value))}
                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">{t("cycle.select_debtor")}</option>
                    {status?.missing_members.map((m) => (
                      <option key={m.membership_id} value={m.membership_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={covererMembershipId ?? ""}
                    onChange={(e) => setCovererMembershipId(Number(e.target.value))}
                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">{t("cycle.select_coverer")}</option>
                    {members
                      .filter((m) => m.membership_status === "active")
                      .map((m) => (
                        <option key={m.membership_id} value={m.membership_id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                  <input
                    value={coverNotes}
                    onChange={(e) => setCoverNotes(e.target.value)}
                    placeholder={t("cycle.cover_notes")}
                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  <button
                    onClick={onRecordCoverPayment}
                    disabled={covering || !debtorMembershipId || !covererMembershipId}
                    className="w-fit rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {covering ? t("cycle.recording") : t("cycle.record_cover", { amount: formatCurrency(payAmount) })}
                  </button>
                </div>
              </section>
            )}

            {debts.filter((d) => !d.is_repaid).length > 0 && (
              <section className="mt-4 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{t("cycle.open_debts")}</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                  {debts
                    .filter((d) => !d.is_repaid)
                    .map((d) => (
                      <li key={d.id}>
                        {t("tontine_detail.debt_line", {
                          cycle: d.cycle_id,
                          debtor: d.debtor_name,
                          coverer: d.coverer_name,
                          amount: d.amount,
                        })}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {cycle?.is_closed && (
              <p className="mt-3 text-sm text-slate-600">{t("cycle.closed_notice")}</p>
            )}

            {!status.is_fully_funded && !cycle?.is_closed && (
              <p className="mt-3 text-sm text-slate-600">
                {t("cycle.close_disabled")}
              </p>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
