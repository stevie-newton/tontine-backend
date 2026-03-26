"use client";

type AuthCodeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  length?: number;
  required?: boolean;
};

export default function AuthCodeField({
  label,
  value,
  onChange,
  placeholder,
  length = 6,
  required,
}: AuthCodeFieldProps) {
  const normalizedValue = value.replace(/\D+/g, "").slice(0, length);
  const digits = Array.from({ length }, (_, index) => normalizedValue[index] ?? "");

  return (
    <div>
      <label className="text-sm font-medium text-[color:var(--brand-ink)]">{label}</label>
      <div className="relative mt-1">
        <input
          className="absolute inset-0 z-10 h-full w-full cursor-text rounded-3xl opacity-0"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value.replace(/\D+/g, "").slice(0, length))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={placeholder}
          required={required}
        />
        <div className="grid grid-cols-6 gap-2 rounded-3xl border border-[rgba(79,107,194,0.16)] bg-white/80 p-3 shadow-[0_18px_36px_rgba(44,102,215,0.08)]">
          {digits.map((digit, index) => (
            <div
              key={index}
              className={[
                "flex h-14 items-center justify-center rounded-2xl border text-lg font-semibold tracking-[0.18em] transition",
                digit
                  ? "border-[rgba(44,102,215,0.34)] bg-[rgba(46,207,227,0.08)] text-[color:var(--brand-ink)]"
                  : "border-[rgba(79,107,194,0.14)] bg-white/90 text-[color:var(--brand-muted)]",
              ].join(" ")}
            >
              {digit || "•"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
