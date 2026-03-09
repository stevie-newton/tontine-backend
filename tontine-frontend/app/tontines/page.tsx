"use client";

import { useCallback, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import { useAuthGuard } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";

type Tontine = {
  id: number;
  name: string;
  contribution_amount: string; // if your backend returns Decimal as str
  total_cycles: number;
  current_cycle: number;
  status: string;
  frequency?: string | null;
};

type PendingInvite = {
  membership_id: number;
  tontine_id: number;
  tontine_name: string;
  invited_at: string;
};

type ReliabilityProfile = {
  reliability_score_percent: number;
  cycles_completed: number;
  late_payments: number;
  debts_repaid: number;
};

export default function TontinesPage() {
  const { t } = useI18n();
  const { loading: authLoading } = useAuthGuard();
  const router = useRouter();
  const [items, setItems] = useState<Tontine[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [reliability, setReliability] = useState<ReliabilityProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<number | null>(null);
  const [rejectingInviteId, setRejectingInviteId] = useState<number | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const load = useCallback(async () => {
    Promise.all([
      apiFetch<Tontine[]>("/tontines/"),
      apiFetch<PendingInvite[]>("/tontine-memberships/pending/me"),
      apiFetch<ReliabilityProfile>("/users/me/reliability"),
    ])
      .then(([tontines, invites, reliabilityProfile]) => {
        setItems(tontines);
        setPendingInvites(invites);
        setReliability(reliabilityProfile);
      })
      .catch((e) => {
        const message = String(e);
        if (message.includes("401")) {
          router.push("/login");
          return;
        }
        setErr(message);
      });
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  if (authLoading) {
    return <PageShell title={t("tontines.title")}>{t("common.loading")}</PageShell>;
  }

  async function onAcceptInvite(membershipId: number) {
    setAcceptingInviteId(membershipId);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/tontine-memberships/${membershipId}/accept`, { method: "POST" });
      setMsg(t("tontines.invite_accepted"));
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setAcceptingInviteId(null);
    }
  }

  async function onRejectInvite(membershipId: number) {
    setRejectingInviteId(membershipId);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/tontine-memberships/${membershipId}/reject`, { method: "POST" });
      setMsg(t("tontines.invite_rejected"));
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setRejectingInviteId(null);
    }
  }

  async function onDeleteAccount() {
    const confirmed = window.confirm(t("account.delete_warning"));
    if (!confirmed) return;

    setDeletingAccount(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/users/me", { method: "DELETE" });
      localStorage.removeItem("access_token");
      router.push("/register");
    } catch (e) {
      setErr(String(e));
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <PageShell
      title={t("tontines.title")}
      subtitle={t("tontines.subtitle")}
      showBack={false}
      right={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/tontines/new"
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {t("tontines.new")}
          </Link>
          <button
            type="button"
            onClick={onDeleteAccount}
            disabled={deletingAccount}
            className="inline-flex items-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
          >
            {deletingAccount ? t("account.deleting") : t("account.delete")}
          </button>
        </div>
      }
    >
      {err && <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</pre>}
      {msg && <p className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</p>}

      {reliability && (
        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t("reliability.title")}</h2>
          <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div>{t("reliability.score", { value: reliability.reliability_score_percent })}</div>
            <div>{t("reliability.cycles_completed", { value: reliability.cycles_completed })}</div>
            <div>{t("reliability.late_payments", { value: reliability.late_payments })}</div>
            <div>{t("reliability.debts_repaid", { value: reliability.debts_repaid })}</div>
          </div>
        </section>
      )}

      {pendingInvites.length > 0 && (
        <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t("tontines.pending_invites")}</h2>
          <p className="mt-1 text-sm text-slate-700">{t("tontines.pending_subtitle")}</p>
          <ul className="mt-3 grid list-none gap-2 p-0">
            {pendingInvites.map((invite) => (
              <li
                key={invite.membership_id}
                className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{invite.tontine_name}</div>
                  <div className="text-xs text-slate-600">{t("tontines.id", { id: invite.tontine_id })}</div>
                </div>
                <button
                  onClick={() => onAcceptInvite(invite.membership_id)}
                  disabled={acceptingInviteId === invite.membership_id || rejectingInviteId === invite.membership_id}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {acceptingInviteId === invite.membership_id ? t("tontines.accepting") : t("tontines.accept")}
                </button>
                <button
                  onClick={() => onRejectInvite(invite.membership_id)}
                  disabled={rejectingInviteId === invite.membership_id || acceptingInviteId === invite.membership_id}
                  className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rejectingInviteId === invite.membership_id ? t("tontines.rejecting") : t("tontines.reject")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t("tontines.create_title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("tontines.create_subtitle")}</p>
        <Link href="/tontines/new" className="mt-3 inline-flex text-sm font-medium text-slate-900 underline">
          {t("tontines.go_create")}
        </Link>
      </section>

      <ul className="grid list-none gap-3 p-0">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-base font-semibold text-slate-900">{item.name}</div>
            <div className="mt-2 text-sm text-slate-700">{t("tontines.amount", { amount: item.contribution_amount })}</div>
            <div className="text-sm text-slate-700">
              {t("tontines.cycle", { current: item.current_cycle, total: item.total_cycles })}
            </div>
            <div className="text-sm text-slate-700">{t("tontines.status", { status: item.status })}</div>
            <Link href={`/tontines/${item.id}`} className="mt-3 inline-flex text-sm font-medium text-slate-900 underline">
              {t("common.open")}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
