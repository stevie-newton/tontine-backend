import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

type PendingInvite = {
  membership_id: number;
  tontine_id: number;
  tontine_name: string;
  invited_at: string;
};

type Reliability = {
  user_id: number;
  tontine_id: number | null;
  reliability_score_percent: number;
  expected_due_cycles: number;
  cycles_completed: number;
  on_time_contributions: number;
  late_payments: number;
  missed_payments: number;
  debts_created: number;
  debts_repaid: number;
  open_debts: number;
};

function getScoreLabel(score: number | null, t: (key: string) => string) {
  if (score === null) return null;
  if (score >= 85) return t("Excellent");
  if (score >= 70) return t("Strong");
  if (score >= 50) return t("Fair");
  return t("Needs work");
}

function getScoreTone(score: number | null) {
  if (score === null) {
    return {
      ring: "#D0D5DD",
      badgeBg: "#F2F4F7",
      badgeBorder: "#D0D5DD",
      badgeText: "#344054",
    };
  }
  if (score >= 85) {
    return {
      ring: "#12B76A",
      badgeBg: "#ECFDF3",
      badgeBorder: "#ABEFC6",
      badgeText: "#067647",
    };
  }
  if (score >= 70) {
    return {
      ring: "#175CD3",
      badgeBg: "#EFF8FF",
      badgeBorder: "#B2DDFF",
      badgeText: "#175CD3",
    };
  }
  if (score >= 50) {
    return {
      ring: "#F79009",
      badgeBg: "#FFF7ED",
      badgeBorder: "#FED7AA",
      badgeText: "#B54708",
    };
  }
  return {
    ring: "#F04438",
    badgeBg: "#FEF3F2",
    badgeBorder: "#FECDCA",
    badgeText: "#B42318",
  };
}

export default function ProfileScreen() {
  const { isLoading, user, signOut } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(true);
  const [reliabilityError, setReliabilityError] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadProfileData = useCallback(async () => {
    setInvitesError(null);
    setReliabilityError(null);
    setInvitesLoading(true);
    setReliabilityLoading(true);
    try {
      const [invitesRes, reliabilityRes] = await Promise.all([
        api.get<PendingInvite[]>("/tontine-memberships/pending/me"),
        api.get<Reliability>("/users/me/reliability"),
      ]);
      setInvites(invitesRes.data);
      setReliability(reliabilityRes.data);
    } catch (e) {
      const message = getErrorMessage(e);
      setInvitesError(message);
      setReliabilityError(message);
    } finally {
      setInvitesLoading(false);
      setReliabilityLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfileData();
    }, [loadProfileData])
  );

  async function acceptInvite(membershipId: number) {
    setInvitesError(null);
    try {
      await api.post(`/tontine-memberships/${membershipId}/accept`);
      await loadProfileData();
    } catch (e) {
      setInvitesError(getErrorMessage(e));
    }
  }

  async function rejectInvite(membershipId: number) {
    setInvitesError(null);
    try {
      await api.post(`/tontine-memberships/${membershipId}/reject`);
      await loadProfileData();
    } catch (e) {
      setInvitesError(getErrorMessage(e));
    }
  }

  async function confirmDeleteAccount() {
    Alert.alert(
      t("Delete account"),
      t("This will permanently delete your account if the backend allows it. Continue?"),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () => {
            void deleteAccount();
          },
        },
      ]
    );
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.delete("/users/me");
      await signOut();
    } catch (e) {
      setDeleteError(getErrorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const score = reliability?.reliability_score_percent ?? null;
  const scoreLabel = getScoreLabel(score, t);
  const scoreTone = getScoreTone(score);
  const userInitial = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return "C";
    return name.charAt(0).toUpperCase();
  }, [user?.name]);

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />

          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{userInitial}</ThemedText>
            </View>
            <View style={styles.identityWrap}>
              <ThemedText style={styles.eyebrow}>Profile</ThemedText>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <ThemedText style={styles.heroTitle}>{user?.name ?? "Cercora member"}</ThemedText>
                  <ThemedText style={styles.heroSubtitle}>{user?.phone ?? "-"}</ThemedText>
                  <View style={styles.heroBadges}>
                    <View
                      style={[
                        styles.heroBadge,
                        user?.is_phone_verified
                          ? styles.heroBadgeSuccess
                          : styles.heroBadgeMuted,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.heroBadgeText,
                          user?.is_phone_verified
                            ? styles.heroBadgeTextSuccess
                            : styles.heroBadgeTextMuted,
                        ]}
                      >
                        {user?.is_phone_verified ? "Phone verified" : "Phone unverified"}
                      </ThemedText>
                    </View>
                    {user?.is_global_admin ? (
                      <View style={[styles.heroBadge, styles.heroBadgeAdmin]}>
                        <ThemedText style={[styles.heroBadgeText, styles.heroBadgeTextAdmin]}>
                          Global admin
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Reliability</ThemedText>
            <ThemedText style={styles.sectionCaption}>
              Your current contribution and repayment posture
            </ThemedText>
          </View>

          <View style={styles.card}>
            {reliabilityLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <ThemedText style={styles.supportText}>Loading your score...</ThemedText>
              </View>
            ) : reliabilityError ? (
              <ThemedText style={styles.errorText}>{reliabilityError}</ThemedText>
            ) : reliability ? (
              <>
                <View style={styles.scoreHero}>
                  <View style={[styles.scoreRing, { borderColor: scoreTone.ring }]}>
                    <ThemedText style={styles.scoreValue}>
                      {reliability.reliability_score_percent}%
                    </ThemedText>
                  </View>
                  <View style={styles.scoreMeta}>
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor: scoreTone.badgeBg,
                          borderColor: scoreTone.badgeBorder,
                        },
                      ]}
                    >
                      <ThemedText style={[styles.scoreBadgeText, { color: scoreTone.badgeText }]}>
                        {scoreLabel}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.supportText}>
                      Based on on-time contributions, completed due cycles, and debt repayment behavior.
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.on_time_contributions}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>On time</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.late_payments}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>Late</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.missed_payments}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>Missed</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.open_debts}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>Open debts</ThemedText>
                  </View>
                </View>
              </>
            ) : (
              <ThemedText style={styles.supportText}>No score available yet.</ThemedText>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Invites</ThemedText>
            <ThemedText style={styles.sectionCaption}>
              Join new circles directly from your profile
            </ThemedText>
          </View>

          <View style={styles.card}>
            {invitesLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <ThemedText style={styles.supportText}>Loading invites...</ThemedText>
              </View>
            ) : invitesError ? (
              <ThemedText style={styles.errorText}>{invitesError}</ThemedText>
            ) : invites.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No pending invites</ThemedText>
                <ThemedText style={styles.supportText}>
                  New tontine invitations will appear here with quick accept and reject actions.
                </ThemedText>
              </View>
            ) : (
              invites.map((invite) => (
                <View key={invite.membership_id} style={styles.inviteCard}>
                  <View style={styles.inviteInfo}>
                    <ThemedText style={styles.inviteTitle}>{invite.tontine_name}</ThemedText>
                    <ThemedText style={styles.supportText}>Pending invitation</ThemedText>
                  </View>
                  <View style={styles.inviteActions}>
                    <Pressable
                      style={styles.acceptButton}
                      onPress={() => void acceptInvite(invite.membership_id)}
                    >
                      <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => void rejectInvite(invite.membership_id)}
                    >
                      <ThemedText style={styles.rejectButtonText}>Reject</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Language</ThemedText>
            <ThemedText style={styles.sectionCaption}>
              {t("The app will immediately switch between English and French.")}
            </ThemedText>
          </View>

          <View style={styles.card}>
            <ThemedText style={styles.accountTitle}>{t("Choose your app language")}</ThemedText>
            <View style={styles.inviteActions}>
              <Pressable
                style={[
                  styles.rejectButton,
                  locale === "en" ? styles.languageButtonActive : null,
                ]}
                onPress={() => void setLocale("en")}
              >
                <ThemedText
                  style={[
                    styles.rejectButtonText,
                    locale === "en" ? styles.languageButtonTextActive : null,
                  ]}
                >
                  {t("English")}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.rejectButton,
                  locale === "fr" ? styles.languageButtonActive : null,
                ]}
                onPress={() => void setLocale("fr")}
              >
                <ThemedText
                  style={[
                    styles.rejectButtonText,
                    locale === "fr" ? styles.languageButtonTextActive : null,
                  ]}
                >
                  {t("French")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Account</ThemedText>
            <ThemedText style={styles.sectionCaption}>
              Manage session access and irreversible account actions
            </ThemedText>
          </View>

          <View style={styles.card}>
            <View style={styles.accountPanel}>
              <ThemedText style={styles.accountTitle}>Delete account</ThemedText>
              <ThemedText style={styles.supportText}>
                This only succeeds if you do not own or belong to an active tontine and no protected financial records block removal.
              </ThemedText>
              {deleteError ? <ThemedText style={styles.errorText}>{deleteError}</ThemedText> : null}
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed ? styles.deleteButtonPressed : null,
                ]}
                disabled={deleteBusy}
                onPress={() => void confirmDeleteAccount()}
              >
                {deleteBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.deleteButtonText}>Delete account</ThemedText>
                )}
              </Pressable>
            </View>

            <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
              <ThemedText style={styles.signOutButtonText}>Sign out</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 18,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: BrandColors.blueDeep,
    padding: 22,
    ...BrandShadow,
  },
  heroGlowTop: {
    position: "absolute",
    top: -30,
    right: -24,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.28,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -10,
    bottom: -54,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.15,
  },
  profileRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
  },
  identityWrap: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: "#D7E7FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#E6EEFF",
    fontSize: 15,
    lineHeight: 20,
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeSuccess: {
    backgroundColor: "rgba(236, 253, 243, 0.14)",
    borderColor: "rgba(171, 239, 198, 0.45)",
  },
  heroBadgeMuted: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  heroBadgeAdmin: {
    backgroundColor: "rgba(138, 55, 201, 0.16)",
    borderColor: "rgba(138, 55, 201, 0.36)",
  },
  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroBadgeTextSuccess: {
    color: "#D9FBE8",
  },
  heroBadgeTextMuted: {
    color: "#EAF1FF",
  },
  heroBadgeTextAdmin: {
    color: "#F0D9FF",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
    paddingHorizontal: 2,
  },
  sectionCaption: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 14,
    ...BrandShadow,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  scoreHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scoreRing: {
    width: 104,
    height: 104,
    borderRadius: 999,
    borderWidth: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  scoreValue: {
    color: BrandColors.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  scoreMeta: {
    flex: 1,
    gap: 8,
  },
  scoreBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scoreBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 4,
  },
  metricValue: {
    color: BrandColors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  metricLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    gap: 8,
  },
  emptyTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  inviteCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 12,
  },
  inviteInfo: {
    gap: 4,
  },
  inviteTitle: {
    color: BrandColors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  inviteActions: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 12,
    alignItems: "center",
    ...BrandShadow,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  rejectButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: BrandColors.surfaceStrong,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "700",
  },
  accountPanel: {
    gap: 8,
  },
  accountTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  deleteButton: {
    borderRadius: 18,
    backgroundColor: BrandColors.dangerText,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  deleteButtonPressed: {
    opacity: 0.92,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  signOutButton: {
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 14,
    alignItems: "center",
    ...BrandShadow,
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  languageButtonActive: {
    backgroundColor: BrandColors.blueDeep,
  },
  languageButtonTextActive: {
    color: "#FFFFFF",
  },
});
