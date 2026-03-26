export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
  searchValue: string;
};

const COUNTRY_ROWS: Array<[string, string, string]> = [
  ["CM", "Cameroon", "+237"],
  ["CA", "Canada", "+1"],
  ["US", "United States", "+1"],
  ["FR", "France", "+33"],
  ["BE", "Belgium", "+32"],
  ["GB", "United Kingdom", "+44"],
  ["DE", "Germany", "+49"],
  ["CH", "Switzerland", "+41"],
  ["NG", "Nigeria", "+234"],
  ["GH", "Ghana", "+233"],
  ["CI", "Cote d'Ivoire", "+225"],
  ["SN", "Senegal", "+221"],
  ["KE", "Kenya", "+254"],
  ["ZA", "South Africa", "+27"],
  ["MA", "Morocco", "+212"],
  ["TN", "Tunisia", "+216"],
  ["AE", "United Arab Emirates", "+971"],
  ["IN", "India", "+91"],
  ["BR", "Brazil", "+55"],
  ["CN", "China", "+86"],
];

export const PHONE_COUNTRIES: PhoneCountry[] = COUNTRY_ROWS.map(([code, name, dialCode]) => ({
  code,
  name,
  dialCode,
  searchValue: `${name} ${code} ${dialCode}`.toLowerCase(),
}));

const DEFAULT_COUNTRY_CODE = "CM";
const COUNTRIES_BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort(
  (left, right) => right.dialCode.length - left.dialCode.length
);

export function getDefaultPhoneCountry() {
  return PHONE_COUNTRIES.find((country) => country.code === DEFAULT_COUNTRY_CODE) ?? PHONE_COUNTRIES[0];
}

export function normalizeLocalPhoneNumber(value: string) {
  return value.replace(/\D+/g, "");
}

export function buildPhoneValue(country: PhoneCountry, localNumber: string) {
  const digits = normalizeLocalPhoneNumber(localNumber);
  return digits ? `${country.dialCode}${digits}` : "";
}

export function parsePhoneValue(value: string) {
  const trimmed = value.trim();
  const fallbackCountry = getDefaultPhoneCountry();

  if (!trimmed) {
    return { country: fallbackCountry, localNumber: "" };
  }

  if (!trimmed.startsWith("+")) {
    return { country: fallbackCountry, localNumber: normalizeLocalPhoneNumber(trimmed) };
  }

  const matchedCountry = COUNTRIES_BY_DIAL_LENGTH.find((country) =>
    trimmed.startsWith(country.dialCode)
  );

  if (!matchedCountry) {
    return { country: fallbackCountry, localNumber: normalizeLocalPhoneNumber(trimmed) };
  }

  return {
    country: matchedCountry,
    localNumber: normalizeLocalPhoneNumber(trimmed.slice(matchedCountry.dialCode.length)),
  };
}
