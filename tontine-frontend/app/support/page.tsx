"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import PageShell from "@/components/PageShell";
import { apiFetch } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";

type SupportTicketResponse = {
  id: number;
  status: string;
  created_at: string;
  email_sent: boolean;
};

export default function SupportPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuthGuard();
  const { t } = useI18n();

  const [message, setMessage] = useState("");
  const [tontineId, setTontineId] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);
    try {
      const payload: { message: string; tontine_id?: number; screenshot_url?: string } = {
        message: message.trim(),
      };
      if (tontineId.trim()) payload.tontine_id = Number(tontineId);
      if (screenshotUrl.trim()) payload.screenshot_url = screenshotUrl.trim();

      const res = await apiFetch<SupportTicketResponse>("/support/ticket", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(t("support.submitted", { id: res.id }));
      setMessage("");
      setTontineId("");
      setScreenshotUrl("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title={t("support.title")}
      subtitle={t("support.subtitle")}
      right={(
        <button
          type="button"
          onClick={() => router.push("/help/faq")}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          {t("support.view_faq")}
        </button>
      )}
    >
      {authLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{t("common.loading")}</div>
      ) : (
        <form onSubmit={submitTicket} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">{t("support.message_label")}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder={t("support.message_placeholder")}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">{t("support.tontine_id_label")}</label>
            <input
              value={tontineId}
              onChange={(e) => setTontineId(e.target.value)}
              type="number"
              min={1}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder={t("support.tontine_id_placeholder")}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">{t("support.screenshot_label")}</label>
            <input
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              type="url"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              placeholder={t("support.screenshot_placeholder")}
            />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? t("support.submitting") : t("support.submit")}
          </button>
        </form>
      )}
    </PageShell>
  );
}
