"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageShell from "@/components/PageShell";
import { apiFetch } from "@/lib/api";
import { useOptionalAuth } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";

type SupportTicketResponse = {
  id: number;
  status: string;
  created_at: string;
  email_sent: boolean;
};

type SupportContactResponse = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export default function SupportPage() {
  const router = useRouter();
  const { me, loading: authLoading } = useOptionalAuth();
  const { t } = useI18n();

  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [message, setMessage] = useState("");
  const [tontineId, setTontineId] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<SupportContactResponse | null>(null);

  useEffect(() => {
    if (me) {
      setRequesterName(me.name);
      setRequesterPhone(me.phone);
    }
  }, [me]);

  useEffect(() => {
    let alive = true;

    async function loadContact() {
      try {
        const data = await apiFetch<SupportContactResponse>("/support/contact");
        if (alive) setContact(data);
      } catch {
        if (alive) setContact({});
      }
    }

    loadContact();
    return () => {
      alive = false;
    };
  }, []);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);
    try {
      const payload: {
        message: string;
        requester_name?: string;
        requester_phone?: string;
        tontine_id?: number;
        screenshot_url?: string;
      } = {
        message: message.trim(),
      };
      if (!me) {
        payload.requester_name = requesterName.trim();
        payload.requester_phone = requesterPhone.trim();
      }
      if (tontineId.trim()) payload.tontine_id = Number(tontineId);
      if (screenshotUrl.trim()) payload.screenshot_url = screenshotUrl.trim();

      const res = await apiFetch<SupportTicketResponse>("/support/ticket", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(t("support.submitted", { id: res.id }));
      if (!me) {
        setRequesterName("");
        setRequesterPhone("");
      }
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
        <div className="space-y-6">
          <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t("support.contact_title")}</h2>
            <p className="mt-1 text-sm text-slate-700">{t("support.contact_subtitle")}</p>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {contact?.email && (
                <div>
                  <div className="font-medium text-slate-900">{t("support.email_label")}</div>
                  <a href={`mailto:${contact.email}`} className="text-[color:var(--brand-blue)] hover:underline">
                    {contact.email}
                  </a>
                </div>
              )}

              {contact?.phone && (
                <div>
                  <div className="font-medium text-slate-900">{t("support.phone_contact_label")}</div>
                  <a href={`tel:${contact.phone}`} className="text-[color:var(--brand-blue)] hover:underline">
                    {contact.phone}
                  </a>
                </div>
              )}

              {contact?.address && (
                <div>
                  <div className="font-medium text-slate-900">{t("support.address_label")}</div>
                  <div>{contact.address}</div>
                </div>
              )}

            </div>
          </section>

          <form onSubmit={submitTicket} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {!me && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-800">{t("support.name_label")}</label>
                  <input
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder={t("support.name_placeholder")}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-800">{t("support.phone_label")}</label>
                  <input
                    value={requesterPhone}
                    onChange={(e) => setRequesterPhone(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    placeholder={t("support.phone_placeholder")}
                  />
                </div>
              </>
            )}

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
        </div>
      )}
    </PageShell>
  );
}
