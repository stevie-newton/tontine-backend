"use client";

import { useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import {
  buildPhoneValue,
  normalizeLocalPhoneNumber,
  parsePhoneValue,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from "@/lib/phone-countries";

type AuthPhoneFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
};

const inputClassName =
  "w-full rounded-2xl border border-[rgba(79,107,194,0.18)] bg-white/90 px-4 py-3 text-[color:var(--brand-ink)] placeholder:text-[color:var(--brand-muted)] caret-[color:var(--brand-blue)] outline-none focus:border-[rgba(44,102,215,0.42)] focus:ring-4 focus:ring-[rgba(46,207,227,0.16)]";

export default function AuthPhoneField({
  label,
  value,
  onChange,
  required,
  autoComplete,
}: AuthPhoneFieldProps) {
  const { t } = useI18n();
  const parsedPhone = useMemo(() => parsePhoneValue(value), [value]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return PHONE_COUNTRIES;
    }
    return PHONE_COUNTRIES.filter((country) => country.searchValue.includes(needle));
  }, [query]);

  function updateNumber(nextCountry: PhoneCountry, nextLocalNumber: string) {
    onChange(buildPhoneValue(nextCountry, nextLocalNumber));
  }

  function handleCountrySelect(country: PhoneCountry) {
    setIsOpen(false);
    setQuery("");
    updateNumber(country, parsedPhone.localNumber);
  }

  function handleLocalNumberChange(nextValue: string) {
    const normalized = normalizeLocalPhoneNumber(nextValue);
    updateNumber(parsedPhone.country, normalized);
  }

  return (
    <div>
      <label className="text-sm font-medium text-[color:var(--brand-ink)]">{label}</label>
      <div className="mt-1 flex gap-3">
        <div className="relative min-w-[148px]">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-[rgba(79,107,194,0.18)] bg-white/90 px-4 py-3 text-left text-[color:var(--brand-ink)] shadow-[0_10px_28px_rgba(44,102,215,0.08)] outline-none transition hover:border-[rgba(44,102,215,0.3)] focus:border-[rgba(44,102,215,0.42)] focus:ring-4 focus:ring-[rgba(46,207,227,0.16)]"
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-[0.22em] text-[color:var(--brand-muted)]">
                {parsedPhone.country.code}
              </span>
              <span className="block truncate text-sm font-medium">
                {parsedPhone.country.dialCode}
              </span>
            </span>
            <span className="ml-3 text-xs text-[color:var(--brand-muted)]">
              {isOpen ? t("common.close") : t("common.choose")}
            </span>
          </button>

          {isOpen ? (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-[320px] rounded-3xl border border-[rgba(79,107,194,0.16)] bg-white/96 p-3 shadow-[0_24px_60px_rgba(16,36,72,0.18)] backdrop-blur-sm">
              <input
                className={inputClassName}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("common.search_country")}
              />
              <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                {filteredCountries.map((country) => (
                  <button
                    key={`${country.code}-${country.dialCode}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-[rgba(46,207,227,0.08)]"
                    onClick={() => handleCountrySelect(country)}
                  >
                    <span>
                      <span className="block text-sm font-medium text-[color:var(--brand-ink)]">
                        {country.name}
                      </span>
                      <span className="block text-xs uppercase tracking-[0.2em] text-[color:var(--brand-muted)]">
                        {country.code}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-[color:var(--brand-blue)]">
                      {country.dialCode}
                    </span>
                  </button>
                ))}
                {filteredCountries.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[color:var(--brand-muted)]">
                    {t("common.no_country_match")}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <input
          className={inputClassName}
          placeholder={t("common.local_number_placeholder")}
          value={parsedPhone.localNumber}
          onChange={(event) => handleLocalNumberChange(event.target.value)}
          inputMode="numeric"
          autoComplete={autoComplete}
          required={required}
        />
      </div>
    </div>
  );
}
