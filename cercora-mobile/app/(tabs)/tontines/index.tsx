import { useFocusEffect } from "@react-navigation/native";
import { Link } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import { getErrorMessage } from "@/hooks/error-utils";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

type Tontine = {
  id: number;
  name: string;
  contribution_amount: number | string;
  total_cycles: number;
  current_cycle: number;
  status: string;
  frequency?: string | null;
};

type PendingInvite = {
  membership_id: number;
  tontine_id: number;
  tontine_name: string;
  invited_at: string;
};

type ReliabilityProfile = {
  reliability_score_percent: number;
  cycles_completed: number;
  late_payments: number;
  debts_repaid: number;
};

function formatAmount(value: number | string) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getStatusTone(status: string) {
  const value = status.toLowerCase();
  if (value === "active") {
    return {
      bg: BrandColors.successBg,
      border: BrandColors.successBorder,
      text: BrandColors.successText,
    };
  }
  if (value === "completed") {
    return {
      bg: "#F2F4F7",
      border: "#D0D5DD",
      text: "#344054",
    };
  }
  return {
    bg: BrandColors.warningBg,
    border: BrandColors.warningBorder,
    text: BrandColors.warningText,
  };
}

export default function TontinesListScreen() {
  const layout = useResponsiveLayout();
  const { t } = useI18n();
  const [items, setItems] = useState<Tontine[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [reliability, setReliability] = useState<ReliabilityProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState<number | null>(null);
  const [rejectingInviteId, setRejectingInviteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tontines, invites, reliabilityProfile] = await Promise.all([
        api.get<Tontine[]>("/tontines/"),
        api.get<PendingInvite[]>("/tontine-memberships/pending/me"),
        api.get<ReliabilityProfile>("/users/me/reliability"),
      ]);

      setItems(tontines.data);
      setPendingInvites(invites.data);
      setReliability(reliabilityProfile.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
  }

  async function onAcceptInvite(membershipId: number) {
    setAcceptingInviteId(membershipId);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/tontine-memberships/${membershipId}/accept`);
      setMessage(t("Invite accepted."));
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAcceptingInviteId(null);
    }
  }

  async function onRejectInvite(membershipId: number) {
    setRejectingInviteId(membershipId);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/tontine-memberships/${membershipId}/reject`);
      setMessage(t("Invite rejected."));
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRejectingInviteId(null);
    }
  }

  const summary = useMemo(() => {
    const active = items.filter((item) => item.status === "active").length;
    return {
      total: items.length,
      active,
      pendingInvites: pendingInvites.length,
      reliability: reliability?.reliability_score_percent ?? null,
    };
  }, [items, pendingInvites.length, reliability?.reliability_score_percent]);

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <FlatList
        data={items}
        numColumns={layout.isTablet ? 2 : 1}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.content}
        columnWrapperStyle={layout.isTablet ? styles.groupRow : undefined}
        ListHeaderComponent={
          <View
            style={[
              styles.headerWrap,
              layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
            ]}
          >
            <View style={styles.pageHeader}>
              <View style={styles.pageHeaderText}>
                <ThemedText style={styles.pageTitle}>{t("Your tontines")}</ThemedText>
                <ThemedText style={styles.pageSubtitle}>
                  {t("Manage invites, track your reliability, and open every savings group from one place.")}
                </ThemedText>
              </View>
            </View>

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            {message ? <ThemedText style={styles.success}>{message}</ThemedText> : null}

            <View style={styles.overviewCard}>
              <View style={styles.overviewGlowA} />
              <View style={styles.overviewGlowB} />
              <ThemedText style={styles.eyebrow}>{t("Tontine workspace")}</ThemedText>
              <ThemedText style={styles.overviewTitle}>{t("Keep your groups and invites in sync")}</ThemedText>
              <ThemedText style={styles.overviewSubtitle}>
                {t("This mobile view now follows the same structure as the web page, with your score, pending invites, create action, and group list in one flow.")}
              </ThemedText>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryTile}>
                  <ThemedText style={styles.summaryValue}>
                    {isLoading ? "..." : String(summary.total)}
                  </ThemedText>
                  <ThemedText style={styles.summaryLabel}>{t("Groups")}</ThemedText>
                </View>
                <View style={styles.summaryTile}>
                  <ThemedText style={styles.summaryValue}>
                    {isLoading ? "..." : String(summary.active)}
                  </ThemedText>
                  <ThemedText style={styles.summaryLabel}>{t("Active")}</ThemedText>
                </View>
                <View style={styles.summaryTile}>
                  <ThemedText style={styles.summaryValue}>
                    {isLoading ? "..." : String(summary.pendingInvites)}
                  </ThemedText>
                  <ThemedText style={styles.summaryLabel}>{t("Invites")}</ThemedText>
                </View>
                <View style={styles.summaryTile}>
                  <ThemedText style={styles.summaryValue}>
                    {isLoading
                      ? "..."
                      : summary.reliability === null
                        ? "--"
                        : `${summary.reliability}%`}
                  </ThemedText>
                  <ThemedText style={styles.summaryLabel}>{t("Reliability")}</ThemedText>
                </View>
              </View>
            </View>

            {reliability ? (
              <View style={styles.sectionCard}>
                <ThemedText style={styles.sectionTitle}>{t("Reliability profile")}</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>
                  {t("The same score summary from the web tontines page, adapted for mobile.")}
                </ThemedText>
                <View style={styles.metricGrid}>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.reliability_score_percent}%
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Score")}</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.cycles_completed}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Cycles completed")}</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.late_payments}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Late payments")}</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>
                      {reliability.debts_repaid}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Debts repaid")}</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            {pendingInvites.length > 0 ? (
              <View style={styles.invitesCard}>
                <ThemedText style={styles.sectionTitle}>{t("Pending invites")}</ThemedText>
                <ThemedText style={styles.sectionSubtitle}>
                  {t("Accept or reject invitations without leaving the tontines home screen.")}
                </ThemedText>
                <View style={styles.invitesList}>
                  {pendingInvites.map((invite) => (
                    <View key={invite.membership_id} style={styles.inviteItem}>
                      <View style={styles.inviteText}>
                        <ThemedText style={styles.inviteTitle}>{invite.tontine_name}</ThemedText>
                        <ThemedText style={styles.inviteMeta}>
                          {t("Tontine ID #{{id}}", { id: invite.tontine_id })}
                        </ThemedText>
                      </View>
                      <View style={styles.inviteActions}>
                        <Pressable
                          style={styles.acceptButton}
                          disabled={
                            acceptingInviteId === invite.membership_id ||
                            rejectingInviteId === invite.membership_id
                          }
                          onPress={() => void onAcceptInvite(invite.membership_id)}
                        >
                          {acceptingInviteId === invite.membership_id ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <ThemedText style={styles.acceptButtonText}>{t("Accept")}</ThemedText>
                          )}
                        </Pressable>
                        <Pressable
                          style={styles.rejectButton}
                          disabled={
                            rejectingInviteId === invite.membership_id ||
                            acceptingInviteId === invite.membership_id
                          }
                          onPress={() => void onRejectInvite(invite.membership_id)}
                        >
                          {rejectingInviteId === invite.membership_id ? (
                            <ActivityIndicator color={BrandColors.dangerText} />
                          ) : (
                            <ThemedText style={styles.rejectButtonText}>{t("Reject")}</ThemedText>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <ThemedText style={styles.sectionTitle}>{t("Create a new tontine")}</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>
                {t("Start a new savings group, then invite members and generate cycles from its workspace.")}
              </ThemedText>
              <Link href="/(tabs)/tontines/create" asChild>
                <Pressable style={styles.inlineLink}>
                  <ThemedText style={styles.inlineLinkText}>{t("Go to create form")}</ThemedText>
                </Pressable>
              </Link>
            </View>

            <ThemedText style={styles.listHeading}>{t("Your groups")}</ThemedText>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              style={[
                styles.loadingState,
                layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
              ]}
            >
              <ActivityIndicator />
              <ThemedText style={styles.supportText}>{t("Loading your tontines...")}</ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
              ]}
            >
              <ThemedText style={styles.emptyTitle}>{t("No tontines yet")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t("Create your first savings group to invite members and start building your rotation.")}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => {
          const tone = getStatusTone(item.status);

          return (
            <View
              style={[
                styles.groupCardWrap,
                layout.isTablet ? styles.groupCardWrapTablet : null,
              ]}
            >
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]",
                  params: { tontineId: String(item.id) },
                }}
                asChild
              >
                <Pressable style={styles.groupCard}>
                  <View style={styles.groupTopRow}>
                    <View style={styles.groupTitleWrap}>
                      <ThemedText style={styles.groupTitle}>{item.name}</ThemedText>
                      <ThemedText style={styles.groupMeta}>
                        {item.frequency
                          ? t("{{frequency}} contribution cadence", {
                              frequency: t(
                                item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1).toLowerCase()
                              ).toLowerCase(),
                            })
                          : t("Custom contribution cadence")}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <ThemedText style={[styles.statusBadgeText, { color: tone.text }]}>
                        {t(item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase())}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.groupStats}>
                    <ThemedText style={styles.groupStatText}>
                      {t("Contribution: {{amount}}", {
                        amount: formatAmount(item.contribution_amount),
                      })}
                    </ThemedText>
                    <ThemedText style={styles.groupStatText}>
                      {t("Cycle: {{current}}/{{total}}", {
                        current: item.current_cycle,
                        total: item.total_cycles,
                      })}
                    </ThemedText>
                  </View>

                  <ThemedText style={styles.openLink}>{t("Open group")}</ThemedText>
                </Pressable>
              </Link>
            </View>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 128,
    alignItems: "center",
  },
  headerWrap: {
    width: "100%",
    gap: 16,
  },
  groupRow: {
    width: "100%",
    maxWidth: 980,
    gap: 16,
    justifyContent: "space-between",
  },
  groupCardWrap: {
    width: "100%",
    marginTop: 16,
  },
  groupCardWrapTablet: {
    flex: 1,
    maxWidth: 482,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  pageHeaderText: {
    flex: 1,
    gap: 4,
  },
  pageTitle: {
    color: BrandColors.ink,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  overviewCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: BrandColors.blueNight,
    padding: 24,
    gap: 16,
    ...BrandShadow,
  },
  overviewGlowA: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.28,
  },
  overviewGlowB: {
    position: "absolute",
    left: -16,
    bottom: -46,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.18,
  },
  eyebrow: {
    color: "#D7E7FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  overviewTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  overviewSubtitle: {
    color: "#D9E6FF",
    fontSize: 14,
    lineHeight: 21,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryTile: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    padding: 15,
    gap: 4,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 12,
    ...BrandShadow,
  },
  invitesCard: {
    borderRadius: 28,
    backgroundColor: "rgba(255, 247, 237, 0.92)",
    borderWidth: 1,
    borderColor: "#F7D9A6",
    padding: 20,
    gap: 12,
    ...BrandShadow,
  },
  sectionTitle: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    minWidth: 130,
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
    gap: 4,
  },
  metricValue: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  metricLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  invitesList: {
    gap: 10,
  },
  inviteItem: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#F2C97D",
    padding: 15,
    gap: 12,
  },
  inviteText: {
    gap: 3,
  },
  inviteTitle: {
    color: BrandColors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
  },
  inviteMeta: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  rejectButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.dangerBorder,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  inlineLink: {
    alignSelf: "flex-start",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: "rgba(16,36,72,0.08)",
  },
  inlineLinkText: {
    color: BrandColors.inkSoft,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  listHeading: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  loadingState: {
    width: "100%",
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyState: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 22,
    gap: 12,
    alignItems: "flex-start",
    ...BrandShadow,
  },
  emptyTitle: {
    color: BrandColors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  groupCard: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 13,
    minHeight: 0,
    ...BrandShadow,
  },
  groupTopRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
  },
  groupTitleWrap: {
    width: "100%",
    gap: 4,
  },
  groupTitle: {
    color: BrandColors.ink,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  groupMeta: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  groupStats: {
    gap: 4,
  },
  groupStatText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  openLink: {
    color: BrandColors.blue,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  error: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  success: {
    color: BrandColors.successText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
