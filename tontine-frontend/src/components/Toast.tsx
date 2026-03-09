"use client";

import { useI18n } from "@/lib/i18n";

export default function Toast({
  kind,
  message,
  onClose,
}: {
  kind: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        border: "1px solid #ddd",
        padding: 12,
        borderRadius: 10,
        background: "white",
        maxWidth: 420,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {kind === "success" ? t("common.success") : t("common.error")}
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{message}</div>
      <button onClick={onClose} style={{ marginTop: 10 }}>
        {t("toast.close")}
      </button>
    </div>
  );
}
