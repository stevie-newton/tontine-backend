"use client";

import { apiFetch, apiFetchText } from "@/lib/api";
import { FormEvent, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import { useAuthGuard } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";

type Tontine = {
  id: number;
  owner_id: number;
  name: string;
  contribution_amount: string;
  total_cycles: number;
  current_cycle: number;
  status: string;
  frequency?: string | null;
};

type CycleStatus = {
  cycle_id: number;
  cycle_number: number;
  is_closed: boolean;
  closed_at?: string | null;
  contributions_count: number;
  expected_contributions: number;
  all_paid: boolean;
  total_amount: string;
  payout_processed: boolean;
  payout_amount?: string | null;
  payout_member_name?: string | null;
};

type CycleStatusResponse = {
  tontine_id: number;
  total_cycles: number;
  cycles: CycleStatus[];
};

type TontineCycle = {
  id: number;
  cycle_number: number;
  is_closed: boolean;
  start_date?: string;
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
  created_at: string;
  repaid_at?: string | null;
};

type DebtListResponse = {
  tontine_id: number;
  count: number;
  debts: DebtRow[];
};

type MemberReliabilityRow = {
  membership_id: number;
  user_id: number;
  name: string;
  reliability_score_percent: number;
  cycles_completed: number;
  late_payments: number;
  debts_repaid: number;
};

type MemberReliabilityResponse = {
  tontine_id: number;
  count: number;
  members: MemberReliabilityRow[];
};

type MyReliabilityProfile = {
  reliability_score_percent: number;
  cycles_completed: number;
  late_payments: number;
  debts_repaid: number;
};

export default function TontineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n();
  const { me, loading: authLoading } = useAuthGuard();
  const router = useRouter();
  const resolvedParams = use(params);
  const tontineId = Number(resolvedParams.id);
  const invalidTontineId = !Number.isFinite(tontineId);

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [cycles, setCycles] = useState<TontineCycle[]>([]);
  const [status, setStatus] = useState<CycleStatusResponse | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberReliability, setMemberReliability] = useState<MemberReliabilityRow[]>([]);
  const [myReliability, setMyReliability] = useState<MyReliabilityProfile | null>(null);
  const [memberReliabilityError, setMemberReliabilityError] = useState<string | null>(null);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [repayingDebtId, setRepayingDebtId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [memberPhone, setMemberPhone] = useState("");
  const isOwner = !!me && !!tontine && me.id === tontine.owner_id;
  const isGlobalAdmin = !!me?.is_global_admin;
  const myMemberRow = me ? members.find((m) => m.id === me.id) : undefined;
  const isAdmin = !!myMemberRow && myMemberRow.membership_role === "admin" && myMemberRow.membership_status === "active";
  const isActiveMember = !!myMemberRow && myMemberRow.membership_status === "active";
  const canManageDebt = isOwner || isAdmin;
  const canViewMemberReliability = isOwner || isActiveMember;
  const hasAnyContributions = !!status?.cycles?.some((c) => c.contributions_count > 0);
  const cycleOne = cycles.find((c) => c.cycle_number === 1);
  const cycleOneStarted =
    !!cycleOne?.start_date && new Date(cycleOne.start_date).getTime() <= Date.now();
  const tontineStarted = (tontine?.status ?? "").toLowerCase() !== "draft" && cycleOneStarted;
  const sortedByPayoutOrder = [...members].sort((a, b) => {
    const ap = a.payout_position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.payout_position ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  function scoreBadgeClass(score: number): string {
    if (score >= 85) return "bg-emerald-100 text-emerald-800";
    if (score >= 70) return "bg-amber-100 text-amber-800";
    return "bg-rose-100 text-rose-800";
  }

  async function loadTontinePageData() {
    const [t, cycleList, memberList, debtList] = await Promise.all([
      apiFetch<Tontine>(`/tontines/${tontineId}`),
      apiFetch<TontineCycle[]>(`/tontine-cycles/tontine/${tontineId}`),
      apiFetch<MemberRow[]>(`/tontine-memberships/tontine/${tontineId}/members`),
      apiFetch<DebtListResponse>(`/debts/tontine/${tontineId}`),
    ]);
    setTontine(t);
    setCycles(cycleList);
    setMembers(memberList);
    setDebts(debtList.debts);

    try {
      const s = await apiFetch<CycleStatusResponse>(`/cycles/status/${tontineId}`);
      setStatus(s);
    } catch {
      setStatus(null);
    }

    try {
      const reliability = await apiFetch<MemberReliabilityResponse>(`/tontines/${tontineId}/reliability`);
      setMemberReliability(reliability.members);
      setMyReliability(null);
      setMemberReliabilityError(null);
    } catch {
      try {
        const mine = await apiFetch<MyReliabilityProfile>(`/users/me/reliability?tontine_id=${tontineId}`);
        setMyReliability(mine);
        setMemberReliability([]);
        setMemberReliabilityError(null);
      } catch (e) {
        setMemberReliability([]);
        setMyReliability(null);
        setMemberReliabilityError(String(e));
      }
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!Number.isFinite(tontineId)) return;
    loadTontinePageData().catch((e) => {
      const message = String(e);
      if (message.includes("401")) {
        router.push("/login");
        return;
      }
      setErr(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, router, tontineId]);

  async function onGenerateCycles() {
    setGenerating(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch<TontineCycle[]>(`/tontine-cycles/generate/${tontineId}`, {
        method: "POST",
      });
      await loadTontinePageData();
      setMsg(t("tontine_detail.cycles_generated"));
    } catch (e) {
      setErr(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function onAddMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const phone = memberPhone.trim();
    if (!phone) {
      setErr(t("tontine_detail.enter_phone"));
      return;
    }
    setAdding(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/tontine-memberships/invite", {
        method: "POST",
        body: JSON.stringify({
          phone,
          tontine_id: tontineId,
          role: "member",
        }),
      });
      await loadTontinePageData();
      setMemberPhone("");
      setMsg(t("tontine_detail.invite_sent"));
    } catch (e) {
      setErr(String(e));
    } finally {
      setAdding(false);
    }
  }

  async function onRepayDebt(debtId: number) {
    setRepayingDebtId(debtId);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/debts/${debtId}/repay`, { method: "POST" });
      await loadTontinePageData();
      setMsg(t("tontine_detail.debt_repaid"));
    } catch (e) {
      setErr(String(e));
    } finally {
      setRepayingDebtId(null);
    }
  }

  async function onExportLedgerCsv() {
    if (!tontine) return;
    setExporting(true);
    setErr(null);
    setMsg(null);
    try {
      const csvText = await apiFetchText(`/transactions/tontine/${tontineId}/export/csv`);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tontine.name.replace(/\s+/g, "_").toLowerCase()}_ledger.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(t("tontine_detail.ledger_exported"));
    } catch (e) {
      setErr(String(e));
    } finally {
      setExporting(false);
    }
  }

  async function onDeleteGroup() {
    setDeleting(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/tontines/${tontineId}`, { method: "DELETE" });
      router.push("/tontines");
    } catch (e) {
      const message = String(e);
      if (message.includes("409")) {
        setErr(t("tontine_detail.cannot_delete_tx"));
      } else {
        setErr(message);
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function onLeaveGroup() {
    if (!myMemberRow?.membership_id) return;
    setLeaving(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/tontine-memberships/${myMemberRow.membership_id}`, { method: "DELETE" });
      router.push("/tontines");
    } catch (e) {
      const message = String(e);
      if (message.includes("409")) {
        if (message.toLowerCase().includes("financial records exist")) {
          setErr(t("tontine_detail.cannot_leave_financial"));
        } else {
          setErr(t("tontine_detail.cannot_leave_started"));
        }
      } else {
        setErr(message);
      }
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }

  if (invalidTontineId) {
    return <PageShell title={t("tontine_detail.title")}>{t("tontine_detail.invalid_id", { id: String(resolvedParams.id) })}</PageShell>;
  }

  if (authLoading) {
    return <PageShell title={t("tontine_detail.title")}>{t("common.loading")}</PageShell>;
  }

  return (
    <PageShell title={tontine?.name ?? t("tontine_detail.title")} subtitle={t("tontine_detail.subtitle")}>
      {err && <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</pre>}
      {msg && <p className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</p>}
      {!tontine ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm">{t("common.loading")}</div>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{tontine.name}</h2>
            <div className="mt-2 text-sm text-slate-700">Contribution: {tontine.contribution_amount}</div>
            <div className="text-sm text-slate-700">
              Current cycle: {tontine.current_cycle}/{tontine.total_cycles}
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("tontine_detail.actions")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {isOwner && (
                <button
                  onClick={onGenerateCycles}
                  disabled={generating}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? t("tontine_detail.generating") : t("tontine_detail.generate_cycles")}
                </button>
              )}
              <button
                onClick={onExportLedgerCsv}
                disabled={exporting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? t("tontine_detail.exporting") : t("tontine_detail.export_csv")}
              </button>
              {(isOwner || isGlobalAdmin) && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                >
                  {t("tontine_detail.delete_group")}
                </button>
              )}
              {!isOwner && myMemberRow && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50"
                >
                  {t("tontine_detail.leave_group")}
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold">{t("tontine_detail.delete_warning")}</p>
                {hasAnyContributions && !isGlobalAdmin && (
                  <p className="mt-2">{t("tontine_detail.cannot_delete_tx")}</p>
                )}
                {isGlobalAdmin && (
                  <p className="mt-2">{t("tontine_detail.global_admin_delete_override")}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={onDeleteGroup}
                    disabled={deleting || (hasAnyContributions && !isGlobalAdmin)}
                    className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? t("tontine_detail.deleting") : t("tontine_detail.confirm_delete")}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

            {showLeaveConfirm && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">
                  {t("tontine_detail.leave_warning")}
                </p>
                {tontineStarted && (
                  <p className="mt-2">{t("tontine_detail.cannot_leave_started")}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={onLeaveGroup}
                    disabled={leaving || tontineStarted}
                    className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {leaving ? t("tontine_detail.leaving") : t("tontine_detail.confirm_leave")}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    disabled={leaving}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

            {isOwner && (
              <form onSubmit={onAddMember} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder={t("tontine_detail.member_phone")}
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:ring"
                />
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adding ? t("tontine_detail.inviting") : t("tontine_detail.invite_member")}
                </button>
              </form>
            )}
          </section>

          {members.length > 0 && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("tontine_detail.members")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("tontine_detail.fifo_hint")}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2">{t("tontine_detail.queue_pos")}</th>
                      <th className="px-2 py-2">{t("reliability.member")}</th>
                      <th className="px-2 py-2">{t("tontine_detail.role")}</th>
                      <th className="px-2 py-2">{t("tontine_detail.status_col")}</th>
                      <th className="px-2 py-2">{t("tontine_detail.debt_col")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByPayoutOrder.map((m) => {
                      const hasOpenDebt = debts.some((d) => !d.is_repaid && d.debtor_user_id === m.id);
                      return (
                        <tr key={m.membership_id} className="border-t border-slate-200">
                          <td className="px-2 py-2 font-medium text-slate-900">
                            {m.payout_position ?? m.rotation_position ?? "-"}
                          </td>
                          <td className="px-2 py-2">{m.name}</td>
                          <td className="px-2 py-2">{m.membership_role}</td>
                          <td className="px-2 py-2">{m.membership_status}</td>
                          <td className="px-2 py-2">{hasOpenDebt ? t("tontine_detail.debt_open") : t("tontine_detail.debt_clear")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {canViewMemberReliability && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("reliability.member_list_title")}</h2>
              {memberReliabilityError && (
                <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {memberReliabilityError}
                </pre>
              )}
              {!memberReliabilityError && memberReliability.length === 0 && (
                <p className="mt-2 text-sm text-slate-600">{t("reliability.no_member_reports")}</p>
              )}
              {!memberReliabilityError && memberReliability.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-700">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2">{t("reliability.member")}</th>
                        <th className="px-2 py-2">{t("reliability.score_short")}</th>
                        <th className="px-2 py-2">{t("reliability.cycles_short")}</th>
                        <th className="px-2 py-2">{t("reliability.late_short")}</th>
                        <th className="px-2 py-2">{t("reliability.repaid_short")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberReliability.map((row) => (
                        <tr key={row.membership_id} className="border-t border-slate-200">
                          <td className="px-2 py-2 font-medium text-slate-900">{row.name}</td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${scoreBadgeClass(row.reliability_score_percent)}`}>
                              {row.reliability_score_percent}%
                            </span>
                          </td>
                          <td className="px-2 py-2">{row.cycles_completed}</td>
                          <td className="px-2 py-2">{row.late_payments}</td>
                          <td className="px-2 py-2">{row.debts_repaid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {!canViewMemberReliability && myReliability && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{t("reliability.title")}</h2>
              <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>{t("reliability.score", { value: myReliability.reliability_score_percent })}</div>
                <div>{t("reliability.cycles_completed", { value: myReliability.cycles_completed })}</div>
                <div>{t("reliability.late_payments", { value: myReliability.late_payments })}</div>
                <div>{t("reliability.debts_repaid", { value: myReliability.debts_repaid })}</div>
              </div>
            </section>
          )}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("tontine_detail.debts")}</h2>
            {debts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{t("tontine_detail.no_debts")}</p>
            ) : (
              <div className="mt-2 space-y-2">
                {debts.map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                    <div>{t("tontine_detail.debt_line", { cycle: d.cycle_id, debtor: d.debtor_name, coverer: d.coverer_name, amount: d.amount })}</div>
                    <div>{t("tontine_detail.debt_status", { status: d.is_repaid ? "Repaid" : "Open" })}</div>
                    {d.notes && <div>{t("tontine_detail.notes", { notes: d.notes })}</div>}
                    {!d.is_repaid && canManageDebt && (
                      <button
                        onClick={() => onRepayDebt(d.id)}
                        disabled={repayingDebtId === d.id}
                        className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {repayingDebtId === d.id ? t("tontine_detail.repaying") : t("tontine_detail.mark_repaid")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{t("tontine_detail.cycles")}</h2>
            {cycles.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm">
                {t("tontine_detail.no_cycles")}
              </div>
            )}
            <ul className="grid list-none gap-3 p-0">
              {cycles.map((cycle) => {
                const s = status?.cycles?.find((x) => x.cycle_number === cycle.cycle_number);
                return (
                  <li key={cycle.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Cycle #{cycle.cycle_number}</div>
                    <div className="mt-1 text-sm text-slate-700">{t("tontine_detail.closed", { value: String(s?.is_closed ?? cycle.is_closed) })}</div>
                    {s && (
                      <>
                        <div className="text-sm text-slate-700">
                          {t("tontine_detail.paid_summary", {
                            count: s.contributions_count,
                            expected: s.expected_contributions,
                            status: s.all_paid ? "OK" : "Missing",
                          })}
                        </div>
                        <div className="text-sm text-slate-700">{t("tontine_detail.total", { amount: s.total_amount })}</div>
                      </>
                    )}
                    <Link href={`/cycles/${cycle.id}`} className="mt-2 inline-flex text-sm font-medium text-slate-900 underline">
                      {t("tontine_detail.open_cycle")}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </PageShell>
  );
}
