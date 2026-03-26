"use client";

import { useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";

type AuthPasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  showStrength?: boolean;
};

const inputClassName =
  "w-full rounded-2xl border border-[rgba(79,107,194,0.18)] bg-white/90 px-4 py-3 pr-20 text-[color:var(--brand-ink)] placeholder:text-[color:var(--brand-muted)] caret-[color:var(--brand-blue)] outline-none focus:border-[rgba(44,102,215,0.42)] focus:ring-4 focus:ring-[rgba(46,207,227,0.16)]";

function getPasswordScore(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export default function AuthPasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  showStrength,
}: AuthPasswordFieldProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const score = useMemo(() => getPasswordScore(value), [value]);

  const strengthLabel =
    score >= 4
      ? t("common.password_strong")
      : score >= 2
        ? t("common.password_getting_there")
        : t("common.password_make_stronger");

  return (
    <div>
      <label className="text-sm font-medium text-[color:var(--brand-ink)]">{label}</label>
      <div className="relative mt-1">
        <input
          className={inputClassName}
          placeholder={placeholder}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-3 my-auto rounded-full border border-[rgba(79,107,194,0.16)] bg-white/90 px-3 py-1 text-xs font-medium text-[color:var(--brand-blue)] shadow-[0_10px_24px_rgba(44,102,215,0.08)]"
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? t("common.hide") : t("common.show")}
        </button>
      </div>

      {showStrength ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={[
                  "h-1.5 flex-1 rounded-full transition",
                  score > index
                    ? "bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_60%,#8a37c9_100%)]"
                    : "bg-[rgba(79,107,194,0.14)]",
                ].join(" ")}
              />
            ))}
          </div>
          <p className="text-xs text-[color:var(--brand-muted)]">{strengthLabel}</p>
        </div>
      ) : null}
    </div>
  );
}
