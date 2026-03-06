import re
from typing import List


def normalize_phone(raw_phone: str) -> str:
    """
    Normalize phone input with international support:
    - Keep E.164 format when number starts with + (strip separators)
    - Convert 00-prefixed international numbers to +
    - Preserve legacy North America convenience:
      - 10 digits -> +1XXXXXXXXXX
      - 11 digits starting with 1 -> +1XXXXXXXXXX
    - For other local formats, return digits-only as fallback
    """
    raw = (raw_phone or "").strip()
    if not raw:
        return ""

    if raw.startswith("+"):
        return "+" + re.sub(r"\D", "", raw[1:])

    if raw.startswith("00"):
        return "+" + re.sub(r"\D", "", raw[2:])

    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return digits


def phone_lookup_candidates(raw_phone: str) -> List[str]:
    """
    Build candidate values for DB lookup to support legacy stored formats.
    """
    raw = (raw_phone or "").strip()
    normalized = normalize_phone(raw)
    digits = re.sub(r"\D", "", raw)
    candidates = [c for c in [normalized, raw, digits] if c]
    seen = set()
    ordered = []
    for value in candidates:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered
