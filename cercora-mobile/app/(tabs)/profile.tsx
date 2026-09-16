import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { useRouter } from "expo-router";
import { PasswordInput } from "@/components/password-input";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
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
  const { biometric, disableBiometricSignIn, enableBiometricSignIn, isLoading, user, signOut } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const layout = useResponsiveLayout();
  const colors = useSurfaceColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showReliabilityDetails, setShowReliabilityDetails] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(true);
  const [reliabilityError, setReliabilityError] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [biometricPassword, setBiometricPassword] = useState("");

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
      t("Account deletion is permanent. Active tontines or protected financial records may prevent deletion."),
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

  async function turnOffBiometricSignIn() {
    setBiometricBusy(true);
    setBiometricError(null);
    try {
      await disableBiometricSignIn();
    } catch (e) {
      setBiometricError(getErrorMessage(e));
    } finally {
      setBiometricBusy(false);
    }
  }

  async function turnOnBiometricSignIn() {
    const cleanPassword = biometricPassword.trim();
    if (!user?.phone) {
      setBiometricError(t("We could not find your phone number for biometric setup."));
      return;
    }
    if (!cleanPassword) {
      setBiometricError(t("Enter your current password to enable biometric sign-in."));
      return;
    }

    setBiometricBusy(true);
    setBiometricError(null);
    try {
      await enableBiometricSignIn({ phone: user.phone, password: cleanPassword });
      setBiometricPassword("");
      setShowBiometricSetup(false);
    } catch (e) {
      setBiometricError(getErrorMessage(e));
    } finally {
      setBiometricBusy(false);
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
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); void loadProfileData().finally(() => setRefreshing(false)); }} />}>
          <View
            style={[
              styles.page,
              { maxWidth: Math.min(layout.maxWidth ?? 760, 760) },
            ]}
          >
            <ThemedText style={AppTypography.heading}>{t("Profile")}</ThemedText>
            <View style={[styles.hero, { borderRadius: 22, backgroundColor: "#132D52", shadowOpacity: 0, elevation: 0 }]}>

              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarText}>{userInitial}</ThemedText>
                </View>
                <View style={styles.identityWrap}>
                  <ThemedText style={styles.eyebrow}>{t("Profile")}</ThemedText>
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <ThemedText style={styles.heroTitle}>{user?.name ?? t("Cercora member")}</ThemedText>
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
                            {user?.is_phone_verified ? t("Phone verified") : t("Phone unverified")}
                          </ThemedText>
                        </View>
                        {user?.is_global_admin ? (
                          <View style={[styles.heroBadge, styles.heroBadgeAdmin]}>
                            <ThemedText style={[styles.heroBadgeText, styles.heroBadgeTextAdmin]}>
                              {t("Global admin")}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>

            {invitesLoading || invitesError || invites.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle">{t("Pending invitations")}</ThemedText>

                </View>

                <AppCard>
                  {invitesLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator />
                      <ThemedText style={[styles.supportText, { color: colors.muted }]}>{t("Loading invites...")}</ThemedText>
                    </View>
                  ) : invitesError ? (
                    <ThemedText style={[styles.errorText, { color: colors.accent }]}>{invitesError}</ThemedText>
                  ) : (
                    invites.map((invite) => (
                      <View key={invite.membership_id} style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.inviteInfo}>
                          <ThemedText style={[styles.inviteTitle, { color: colors.accent }]}>{invite.tontine_name}</ThemedText>
                          <ThemedText style={[styles.supportText, { color: colors.muted }]}>{t("Pending invitation")}</ThemedText>
                        </View>
                        <View style={styles.inviteActions}>
                          <Pressable
                            style={styles.acceptButton}
                            onPress={() => void acceptInvite(invite.membership_id)}
                          >
                            <ThemedText style={styles.acceptButtonText}>{t("Accept")}</ThemedText>
                          </Pressable>
                          <Pressable
                            style={styles.rejectButton}
                            onPress={() => void rejectInvite(invite.membership_id)}
                          >
                            <ThemedText style={styles.rejectButtonText}>{t("Reject")}</ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </AppCard>
              </View>
            ) : null}

            <View style={styles.section}>
              <ThemedText type="subtitle">{t("Language")}</ThemedText>
              <AppCard>
                <ThemedText style={{ color: colors.muted }}>{t("Choose your app language.")}</ThemedText>
                <View style={styles.inviteActions}>
                  {(["en", "fr"] as const).map((language) => (
                    <Pressable
                      key={language}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: locale === language }}
                      style={[styles.rejectButton, { backgroundColor: colors.track }, locale === language ? styles.languageButtonActive : null]}
                      onPress={() => void setLocale(language)}
                    >
                      <ThemedText style={[styles.rejectButtonText, { color: colors.accent }, locale === language ? styles.languageButtonTextActive : null]}>
                        {language === "en" ? t("English") : t("French")}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </AppCard>
            </View>

            <View style={styles.section}>
              <ThemedText style={AppTypography.section}>{t("Notifications")}</ThemedText>
              <AppCard>
                <View style={styles.securityRow}>
                  <Ionicons name="notifications-outline" size={24} color={colors.accent} />
                  <View style={styles.securityCopy}>
                    <ThemedText type="defaultSemiBold">{t("Contribution reminders")}</ThemedText>
                    <ThemedText style={{ color: colors.muted }}>{t("Manage alerts and notification permissions.")}</ThemedText>
                  </View>
                </View>
                <AppButton secondary label={t("Manage notifications")} onPress={() => router.push("/(tabs)/reminders")} />
              </AppCard>
            </View>

            <View style={styles.section}>
              <ThemedText type="subtitle">{t("Security")}</ThemedText>
              <AppCard>
                <View style={styles.securityRow}>
                  <View style={styles.securityCopy}>
                    <ThemedText style={[styles.accountTitle, { color: colors.accent }]}>{t("Biometric sign in")}</ThemedText>
                    <ThemedText style={[styles.supportText, { color: colors.muted }]}>
                      {biometric.isAvailable
                        ? t("Use {{label}}", { label: t(biometric.label) })
                        : t("Biometric sign in is not available on this device.")}
                    </ThemedText>
                  </View>
                  {biometricBusy ? <ActivityIndicator color={BrandColors.blue} /> : null}
                  <Switch
                    accessibilityLabel={t("Biometric sign in")}
                    disabled={!biometric.isAvailable || biometricBusy}
                    value={biometric.isEnabled}
                    onValueChange={(enabled) => {
                      setBiometricError(null);
                      if (enabled) setShowBiometricSetup(true);
                      else if (biometric.isEnabled) void turnOffBiometricSignIn();
                      else {
                        setShowBiometricSetup(false);
                        setBiometricPassword("");
                      }
                    }}
                    trackColor={{ false: BrandColors.borderStrong, true: BrandColors.blue }}
                  />
                </View>
                {biometricError ? <ThemedText style={[styles.errorText, { color: colors.accent }]}>{biometricError}</ThemedText> : null}
                {biometric.isAvailable && !biometric.isEnabled && showBiometricSetup ? (
                  <View style={styles.biometricSetupForm}>
                    <ThemedText style={[styles.supportText, { color: colors.muted }]}>
                      {t("Confirm your password to turn on biometric sign-in for this device.")}
                    </ThemedText>
                    <PasswordInput value={biometricPassword} onChangeText={setBiometricPassword} placeholder={t("Enter your password")} />
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.biometricButton, { backgroundColor: colors.track }]}
                      disabled={biometricBusy}
                      onPress={() => void turnOnBiometricSignIn()}
                    >
                      <ThemedText style={[styles.biometricButtonText, { color: colors.accent }]}>
                        {t("Enable {{label}}", { label: t(biometric.label) })}
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={biometricBusy}
                      style={styles.detailsButton}
                      onPress={() => {
                        setShowBiometricSetup(false);
                        setBiometricPassword("");
                        setBiometricError(null);
                      }}
                    >
                      <ThemedText style={[styles.supportText, { color: colors.muted }]}>{t("Cancel")}</ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </AppCard>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle">{t("Reliability")}</ThemedText>
              </View>

              <AppCard>
                {reliabilityLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator />
                    <ThemedText style={[styles.supportText, { color: colors.muted }]}>{t("Loading your score...")}</ThemedText>
                  </View>
                ) : reliabilityError ? (
                  <ThemedText style={[styles.errorText, { color: colors.accent }]}>{reliabilityError}</ThemedText>
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

                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showReliabilityDetails }}
                      onPress={() => setShowReliabilityDetails((current) => !current)}
                      style={styles.detailsButton}
                    >
                      <ThemedText style={[styles.biometricButtonText, { color: colors.accent }]}>
                        {showReliabilityDetails ? t("Hide details") : t("View details")}
                      </ThemedText>
                      <Ionicons name={showReliabilityDetails ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} />
                    </Pressable>
                    {showReliabilityDetails ? (
                      <View style={styles.section}>
                        <ThemedText style={[styles.supportText, { color: colors.muted }]}>
                          {t("Based on on-time contributions, completed due cycles, and debt repayment behavior.")}
                        </ThemedText>
                        <View style={styles.metricsGrid}>
                          <View style={[styles.metricTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
                              {reliability.on_time_contributions}
                            </ThemedText>
                            <ThemedText style={[styles.metricLabel, { color: colors.muted }]}>{t("On time")}</ThemedText>
                          </View>
                          <View style={[styles.metricTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
                              {reliability.late_payments}
                            </ThemedText>
                            <ThemedText style={[styles.metricLabel, { color: colors.muted }]}>{t("Late")}</ThemedText>
                          </View>
                          <View style={[styles.metricTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
                              {reliability.missed_payments}
                            </ThemedText>
                            <ThemedText style={[styles.metricLabel, { color: colors.muted }]}>{t("Missed")}</ThemedText>
                          </View>
                          <View style={[styles.metricTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
                              {reliability.open_debts}
                            </ThemedText>
                            <ThemedText style={[styles.metricLabel, { color: colors.muted }]}>{t("Open debts")}</ThemedText>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <ThemedText style={[styles.supportText, { color: colors.muted }]}>{t("No score available yet.")}</ThemedText>
                )}
              </AppCard>
            </View>


            <AppButton secondary label={t("Sign out")} onPress={() => void signOut()} />

            <View style={styles.deleteSection}>
              <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Account deletion is permanent. Active tontines or protected financial records may prevent deletion.")}</ThemedText>
              {deleteError ? <ThemedText style={[styles.errorText, { color: colors.accent }]}>{deleteError}</ThemedText> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Delete account")}
                accessibilityState={{ disabled: deleteBusy, busy: deleteBusy }}
                style={({ pressed }) => [styles.deleteButton, pressed ? styles.deleteButtonPressed : null]}
                disabled={deleteBusy}
                onPress={() => void confirmDeleteAccount()}
              >
                {deleteBusy ? <ActivityIndicator color={BrandColors.muted} /> : (
                  <ThemedText style={[styles.deleteButtonText, { color: colors.accent }]}>{t("Delete account")}</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  securityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  securityCopy: { flex: 1, gap: 4 },
  detailsButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  deleteSection: { alignItems: "center", gap: 8 },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 128,
    alignItems: "center",
  },
  page: {
    width: "100%",
    gap: 22,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: BrandColors.blueNight,
    padding: 24,
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
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.7,
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
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: 30,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 16,
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
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 4,
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
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
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
  inviteCard: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
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
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 13,
    alignItems: "center",
    ...BrandShadow,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  rejectButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: BrandColors.surfaceMuted,
    paddingVertical: 13,
    alignItems: "center",
  },
  rejectButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "700",
  },
  accountTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  deleteButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonPressed: {
    opacity: 0.82,
  },
  biometricButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(29, 78, 216, 0.16)",
    backgroundColor: "rgba(29, 78, 216, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 6,
  },
  biometricButtonText: {
    color: BrandColors.blueDeep,
    fontWeight: "700",
    fontSize: 14,
  },
  biometricSetupForm: {
    gap: 10,
  },
  deleteButtonText: {
    color: BrandColors.muted,
    fontWeight: "400",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  signOutButton: {
    borderRadius: 20,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 15,
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
