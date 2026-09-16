import * as Linking from "expo-linking";

export const PENDING_INVITATION_KEY = "navigation.pendingInvitation";

export function parseInvitationId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// The link is a destination, not a membership credential. The API still checks
// the signed-in user's pending invitation before allowing acceptance.
export function createInvitationLink(tontineId: number) {
  if (parseInvitationId(String(tontineId)) === null) throw new Error("Invalid tontine id.");
  return Linking.createURL("invitation", { queryParams: { tontineId: String(tontineId) } });
}
