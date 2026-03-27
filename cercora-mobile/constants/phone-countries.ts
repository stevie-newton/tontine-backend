import countries from "world-countries";

export type PhoneCountry = {
  code: string;
  name: string;
  nameFr: string;
  dialCode: string;
  searchValue: string;
};

const DEFAULT_COUNTRY_CODE = "CM";
const SHARED_ROOT_CODES = new Set(["+1", "+7"]);
const POPULAR_COUNTRY_CODES = ["CM", "US", "CA", "FR", "GB", "BE", "DE", "NG", "GH", "CI"];

function normalizeForSearch(value: string) {
  return value.toLowerCase();
}

function resolveDialCode(entry: (typeof countries)[number]) {
  const root = entry.idd?.root;
  const suffixes = entry.idd?.suffixes ?? [];

  if (!root) {
    return null;
  }

  if (SHARED_ROOT_CODES.has(root)) {
    return root;
  }

  return `${root}${suffixes[0] ?? ""}`;
}

function getFrenchName(entry: (typeof countries)[number]) {
  return entry.translations?.fra?.common ?? entry.name.common;
}

const uniqueCountries = new Map<string, PhoneCountry>();

for (const entry of countries) {
  const dialCode = resolveDialCode(entry);

  if (!dialCode || !entry.cca2) {
    continue;
  }

  const dedupeKey = `${entry.cca2}-${dialCode}`;

  if (uniqueCountries.has(dedupeKey)) {
    continue;
  }

  const name = entry.name.common;
  const nameFr = getFrenchName(entry);
  uniqueCountries.set(dedupeKey, {
    code: entry.cca2,
    name,
    nameFr,
    dialCode,
    searchValue: normalizeForSearch(`${name} ${nameFr} ${entry.cca2} ${dialCode}`),
  });
}

function sortCountries(left: PhoneCountry, right: PhoneCountry) {
  const leftPopularity = POPULAR_COUNTRY_CODES.indexOf(left.code);
  const rightPopularity = POPULAR_COUNTRY_CODES.indexOf(right.code);

  if (leftPopularity !== -1 || rightPopularity !== -1) {
    if (leftPopularity === -1) return 1;
    if (rightPopularity === -1) return -1;
    if (leftPopularity !== rightPopularity) {
      return leftPopularity - rightPopularity;
    }
  }

  return left.name.localeCompare(right.name);
}

export const PHONE_COUNTRIES = [...uniqueCountries.values()].sort(sortCountries);

const COUNTRIES_BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort(
  (left, right) => right.dialCode.length - left.dialCode.length
);

export function getDefaultPhoneCountry() {
  return PHONE_COUNTRIES.find((country) => country.code === DEFAULT_COUNTRY_CODE) ?? PHONE_COUNTRIES[0];
}

export function buildPhoneValue(country: PhoneCountry, localNumber: string) {
  const digits = localNumber.replace(/\D+/g, "");
  return digits ? `${country.dialCode}${digits}` : "";
}

export function parsePhoneValue(value: string) {
  const trimmed = value.trim();
  const fallbackCountry = getDefaultPhoneCountry();

  if (!trimmed) {
    return { country: fallbackCountry, localNumber: "" };
  }

  if (!trimmed.startsWith("+")) {
    return { country: fallbackCountry, localNumber: trimmed.replace(/\D+/g, "") };
  }

  const matchedCountry = COUNTRIES_BY_DIAL_LENGTH.find((country) =>
    trimmed.startsWith(country.dialCode)
  );

  if (!matchedCountry) {
    return { country: fallbackCountry, localNumber: trimmed.replace(/\D+/g, "") };
  }

  return {
    country: matchedCountry,
    localNumber: trimmed.slice(matchedCountry.dialCode.length).replace(/\D+/g, ""),
  };
}

export function normalizeLocalPhoneNumber(value: string) {
  return value.replace(/\D+/g, "");
}
