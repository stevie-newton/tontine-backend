import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { ThemedText } from "@/components/themed-text";
import { api } from "@/hooks/api-client";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { PENDING_INVITATION_KEY, parseInvitationId } from "@/hooks/invitation-links";
import { useI18n } from "@/hooks/use-i18n";

type PendingInvite = { membership_id: number; tontine_id: number; tontine_name: string; invited_at: string };

export default function InvitationScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId?: string }>();
  const id = parseInvitationId(tontineId);
  const { user, accessToken } = useAuth();
  const { t } = useI18n();
  const colors = useSurfaceColors();
  const router = useRouter();
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setInvite(null);
    setError(null);
    if (!accessToken || id === null) { setLoading(false); return; }
    setLoading(true);
    void api.get<PendingInvite[]>("/tontine-memberships/pending/me").then(response => {
      if (active) setInvite(response.data.find(item => item.tontine_id === id) ?? null);
    }).catch(e => { if (active) setError(getErrorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, id, retry]);

  async function authenticate(register: boolean) {
    if (id === null || busy) return;
    setBusy(true);
    try {
      await AsyncStorage.setItem(PENDING_INVITATION_KEY, String(id));
      router.push(register ? "/(auth)/register" : "/(auth)/login");
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }
  const accept = useCallback(async () => {
    if (!invite || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/tontine-memberships/${invite.membership_id}/accept`);
      router.replace({ pathname: "/(tabs)/tontines/[tontineId]", params: { tontineId: String(invite.tontine_id) } });
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }, [invite, busy, router]);

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20, width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <ThemedText style={AppTypography.heading}>{t("Tontine invitation")}</ThemedText>
      <AppCard>
        {id === null ? <ThemedText>{t("This invitation link is invalid.")}</ThemedText> : !accessToken ? <>
          <ThemedText>{t("Sign in with the invited phone number to review this invitation.")}</ThemedText>
          <AppButton disabled={busy} label={t("Sign in")} onPress={() => void authenticate(false)} />
          <AppButton disabled={busy} secondary label={t("Create an account")} onPress={() => void authenticate(true)} />
        </> : loading ? <ActivityIndicator color={colors.accent} /> : invite ? <>
          <ThemedText style={AppTypography.section}>{invite.tontine_name}</ThemedText>
          <ThemedText style={{ color: colors.muted }}>{t("Accept this invitation to join the group with your current account.")}</ThemedText>
          <ThemedText>{user?.phone}</ThemedText>
          <AppButton disabled={busy} label={busy ? t("Joining...") : t("Accept invitation")} onPress={() => void accept()} />
        </> : !error ? <>
          <ThemedText>{t("No pending invitation for this group was found for your account.")}</ThemedText>
          <ThemedText style={{ color: colors.muted }}>{t("If you already accepted, open Your tontines. Otherwise, ask the inviter to check your phone number.")}</ThemedText>
        </> : null}
        {error ? <View style={{ gap: 12 }}><ThemedText accessibilityRole="alert">{error}</ThemedText><AppButton disabled={busy} secondary label={t("Try again")} onPress={() => setRetry(value => value + 1)} /></View> : null}
      </AppCard>
      {accessToken ? <AppButton secondary label={t("Your tontines")} onPress={() => router.replace("/(tabs)/tontines")} /> : null}
    </ScrollView>
  </SafeAreaView>;
}
