import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Link } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import { getErrorMessage } from "@/hooks/error-utils";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

type AdminOverview = {
  users: {
    total: number;
    new_last_7_days: number;
    new_last_30_days: number;
    global_admins: number;
  };
  tontines: {
    total: number;
    by_status: { draft: number; active: number; completed: number };
    created_last_7_days: number;
    created_last_30_days: number;
  };
  financial: {
    contributions_last_30_days: number;
    contribution_volume_last_30_days: number;
    payout_volume_last_30_days: number;
    open_debts_count: number;
    open_debts_amount: number;
    repaid_debts_count: number;
    repaid_debts_amount: number;
  };
  risk: {
    cycles_blocked_count: number;
    members_with_open_debt: number;
    repeated_defaulters: number;
  };
};

type AdminTontineStats = {
  total: number;
  by_status: { draft: number; active: number; completed: number };
  created_last_7_days: number;
  created_last_30_days: number;
};

type AdminTontineDirectoryItem = {
  id: number;
  name: string;
  status: string;
  current_cycle: number;
  total_cycles: number;
  contribution_amount: number;
  created_at: string;
  owner_id: number;
  owner_name: string;
  active_members_count: number;
};

type AdminTontineDirectory = {
  count: number;
  items: AdminTontineDirectoryItem[];
};

type AdminReminderPreview = {
  window_start: string;
  window_end: string;
  lookahead_hours: number;
  cycles_count: number;
  targets_count: number;
  cycles: {
    cycle_id: number;
    tontine_id: number;
    tontine_name: string;
    cycle_number: number;
    deadline: string;
    targets_count: number;
    targets: { membership_id: number; user_id: number; name: string; phone: string }[];
  }[];
};

type AdminReminderSendResult = {
  sms_configured: boolean;
  cycles_checked: number;
  cycles_marked: number;
  sms_sent: number;
  sms_failed: number;
};

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAmount(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), { maximumFractionDigits: 2 }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function AdminSkeleton() {
  const { t } = useI18n();
  return (
    <View accessibilityLabel={t("Loading admin overview")} style={styles.skeletonWrap}>
      <View style={styles.skeletonMetrics}>
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.skeletonMetric}>
            <View style={styles.skeletonValue} />
            <View style={styles.skeletonLabel} />
          </View>
        ))}
      </View>
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
    </View>
  );
}

export default function AdminScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const layout = useResponsiveLayout();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tontineStats, setTontineStats] = useState<AdminTontineStats | null>(null);
  const [directory, setDirectory] = useState<AdminTontineDirectory | null>(null);
  const [reminderPreview, setReminderPreview] = useState<AdminReminderPreview | null>(null);
  const [reminderResult, setReminderResult] = useState<AdminReminderSendResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdminData = useCallback(async (refreshing = false) => {
    if (!user?.is_global_admin) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [overviewResponse, statsResponse, previewResponse] = await Promise.all([
        api.get<AdminOverview>("/admin/stats/overview"),
        api.get<AdminTontineStats>("/admin/stats/tontines"),
        api.get<AdminReminderPreview>("/admin/stats/reminders/pre-deadline/preview"),
      ]);
      setOverview(overviewResponse.data);
      setTontineStats(statsResponse.data);
      setReminderPreview(previewResponse.data);

      try {
        const directoryResponse = await api.get<AdminTontineDirectory>(
          "/admin/stats/tontines/list"
        );
        setDirectory(directoryResponse.data);
      } catch {
        setDirectory(null);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setOverview(null);
      setTontineStats(null);
      setReminderPreview(null);
      setDirectory(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.is_global_admin]);

  useFocusEffect(
    useCallback(() => {
      void loadAdminData();
    }, [loadAdminData])
  );

  async function sendReminders() {
    setIsSending(true);
    setError(null);
    try {
      const response = await api.post<AdminReminderSendResult>(
        "/admin/stats/reminders/pre-deadline/send"
      );
      setReminderResult(response.data);
      await loadAdminData(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSending(false);
    }
  }

  if (!user?.is_global_admin) {
    return (
      <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
        <BrandBackdrop />
        <View style={styles.accessState}>
          <Ionicons name="lock-closed-outline" size={30} color={BrandColors.muted} />
          <ThemedText style={styles.accessTitle}>{t("Admin access required")}</ThemedText>
          <ThemedText style={styles.supportText}>
            {t("This area is available only to Cercora global administrators.")}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadAdminData(true)}
          />
        }
      >
        <View style={[styles.page, layout.maxWidth ? { maxWidth: layout.maxWidth } : null]}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerCopy}>
              <ThemedText style={styles.eyebrow}>{t("Administration")}</ThemedText>
              <ThemedText style={styles.title}>{t("Admin center")}</ThemedText>
              <ThemedText style={styles.subtitle}>
                {t("Monitor platform health, groups, risk, and reminder delivery.")}
              </ThemedText>
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable
                accessibilityRole="button"
                style={styles.retryButton}
                onPress={() => void loadAdminData()}
              >
                <ThemedText style={styles.retryButtonText}>{t("Try again")}</ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <ThemedText style={styles.cardTitle}>{t("Platform overview")}</ThemedText>
                <ThemedText style={styles.supportText}>{t("Key activity and risk signals")}</ThemedText>
              </View>
              {!isLoading ? (
                <Pressable
                  accessibilityLabel={t("Refresh admin data")}
                  accessibilityRole="button"
                  disabled={isRefreshing}
                  style={styles.iconButton}
                  onPress={() => void loadAdminData(true)}
                >
                  <Ionicons name="refresh" size={19} color={BrandColors.blueDeep} />
                </Pressable>
              ) : null}
            </View>

            {isLoading ? (
              <AdminSkeleton />
            ) : overview ? (
              <>
                <View style={styles.metricGrid}>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>{formatCompactNumber(overview.users.total)}</ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Users")}</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>{formatCompactNumber(overview.tontines.total)}</ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Tontines")}</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>{formatCompactNumber(overview.financial.open_debts_count)}</ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Open debts")}</ThemedText>
                  </View>
                  <View style={styles.metricTile}>
                    <ThemedText style={styles.metricValue}>{formatCompactNumber(overview.risk.cycles_blocked_count)}</ThemedText>
                    <ThemedText style={styles.metricLabel}>{t("Blocked cycles")}</ThemedText>
                  </View>
                </View>
                <View style={styles.factGrid}>
                  <ThemedText style={styles.factText}>{t("New users 7d: {{count}}", { count: overview.users.new_last_7_days })}</ThemedText>
                  <ThemedText style={styles.factText}>{t("New tontines 7d: {{count}}", { count: overview.tontines.created_last_7_days })}</ThemedText>
                  <ThemedText style={styles.factText}>{t("Contribution volume 30d: {{amount}}", { amount: formatAmount(overview.financial.contribution_volume_last_30_days) })}</ThemedText>
                  <ThemedText style={styles.factText}>{t("Payout volume 30d: {{amount}}", { amount: formatAmount(overview.financial.payout_volume_last_30_days) })}</ThemedText>
                </View>
              </>
            ) : null}
          </View>

          <View style={[styles.columns, layout.isTablet ? styles.columnsTablet : null]}>
            <View style={[styles.card, layout.isTablet ? styles.column : null]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <ThemedText style={styles.cardTitle}>{t("Tontine directory")}</ThemedText>
                  <ThemedText style={styles.supportText}>{t("Recent groups and current status")}</ThemedText>
                </View>
                <Link href="/(tabs)/tontines" asChild>
                  <Pressable accessibilityRole="link" style={styles.textButton}>
                    <ThemedText style={styles.textButtonLabel}>{t("View all")}</ThemedText>
                  </Pressable>
                </Link>
              </View>

              {isLoading ? (
                <AdminSkeleton />
              ) : (
                <>
                  {tontineStats ? (
                    <View style={styles.statusRow}>
                      <View style={styles.statusPill}><ThemedText style={styles.statusText}>{t("Draft")}: {tontineStats.by_status.draft}</ThemedText></View>
                      <View style={styles.statusPill}><ThemedText style={styles.statusText}>{t("Active")}: {tontineStats.by_status.active}</ThemedText></View>
                      <View style={styles.statusPill}><ThemedText style={styles.statusText}>{t("Completed")}: {tontineStats.by_status.completed}</ThemedText></View>
                    </View>
                  ) : null}

                  {directory?.items.length ? (
                    directory.items.slice(0, 6).map((item) => (
                      <Link
                        key={item.id}
                        href={{
                          pathname: "/(tabs)/tontines/[tontineId]",
                          params: { tontineId: String(item.id) },
                        }}
                        asChild
                      >
                        <Pressable accessibilityRole="link" style={styles.directoryRow}>
                          <View style={styles.directoryCopy}>
                            <ThemedText style={styles.rowTitle}>{item.name}</ThemedText>
                            <ThemedText style={styles.supportText}>{t("Owner")}: {item.owner_name}</ThemedText>
                            <ThemedText style={styles.rowMeta}>
                              {item.active_members_count} {t("members")} · {t("Cycle")} {item.current_cycle}/{item.total_cycles}
                            </ThemedText>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={BrandColors.muted} />
                        </Pressable>
                      </Link>
                    ))
                  ) : (
                    <ThemedText style={styles.supportText}>{t("No tontine groups available.")}</ThemedText>
                  )}
                </>
              )}
            </View>

            <View style={[styles.card, layout.isTablet ? styles.column : null]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <ThemedText style={styles.cardTitle}>{t("Reminder operations")}</ThemedText>
                  <ThemedText style={styles.supportText}>{t("Preview and send pre-deadline SMS")}</ThemedText>
                </View>
              </View>

              {isLoading ? (
                <AdminSkeleton />
              ) : reminderPreview ? (
                <>
                  <View style={styles.metricGrid}>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>{reminderPreview.cycles_count}</ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Cycles")}</ThemedText>
                    </View>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>{reminderPreview.targets_count}</ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Recipients")}</ThemedText>
                    </View>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>{reminderPreview.lookahead_hours}h</ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Lookahead")}</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.rowMeta}>
                    {formatShortDate(reminderPreview.window_start)} – {formatShortDate(reminderPreview.window_end)}
                  </ThemedText>

                  {reminderPreview.cycles.slice(0, 4).map((cycle) => (
                    <View key={cycle.cycle_id} style={styles.previewRow}>
                      <View style={styles.directoryCopy}>
                        <ThemedText style={styles.rowTitle}>{cycle.tontine_name}</ThemedText>
                        <ThemedText style={styles.rowMeta}>{t("Cycle {{number}}", { number: cycle.cycle_number })} · {formatShortDate(cycle.deadline)}</ThemedText>
                      </View>
                      <View style={styles.countBadge}>
                        <ThemedText style={styles.countBadgeText}>{cycle.targets_count}</ThemedText>
                      </View>
                    </View>
                  ))}

                  <Pressable
                    accessibilityRole="button"
                    disabled={isSending || reminderPreview.targets_count === 0}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed ? styles.primaryButtonPressed : null,
                      isSending || reminderPreview.targets_count === 0 ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => void sendReminders()}
                  >
                    {isSending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>{t("Send reminder batch")}</ThemedText>
                    )}
                  </Pressable>

                  {reminderResult ? (
                    <View style={styles.resultCard}>
                      <Ionicons name="checkmark-circle" size={20} color={BrandColors.successText} />
                      <ThemedText style={styles.resultText}>
                        {t("Last send: {{sent}} sent, {{failed}} failed, {{marked}} cycle(s) marked.", {
                          sent: reminderResult.sms_sent,
                          failed: reminderResult.sms_failed,
                          marked: reminderResult.cycles_marked,
                        })}
                      </ThemedText>
                    </View>
                  ) : null}
                </>
              ) : (
                <ThemedText style={styles.supportText}>{t("No reminder preview available.")}</ThemedText>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 128, alignItems: "center" },
  page: { width: "100%", gap: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 26,
    backgroundColor: BrandColors.blueNight,
    padding: 20,
    ...BrandShadow,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.blue,
  },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: "#CFE0FF", fontSize: 12, lineHeight: 16, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  title: { color: "#FFFFFF", fontSize: 28, lineHeight: 33, fontWeight: "800" },
  subtitle: { color: "#D7E4FF", fontSize: 14, lineHeight: 20 },
  columns: { gap: 18 },
  columnsTablet: { flexDirection: "row", alignItems: "flex-start" },
  column: { flex: 1 },
  card: {
    borderRadius: 26,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 16,
    ...BrandShadow,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardHeaderCopy: { flex: 1, gap: 2 },
  cardTitle: { color: BrandColors.ink, fontSize: 19, lineHeight: 25, fontWeight: "800" },
  supportText: { color: BrandColors.muted, fontSize: 14, lineHeight: 20 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metricTile: { minWidth: 92, flexGrow: 1, borderRadius: 17, backgroundColor: BrandColors.surfaceStrong, borderWidth: 1, borderColor: BrandColors.border, padding: 13, gap: 3 },
  metricValue: { color: BrandColors.ink, fontSize: 21, lineHeight: 25, fontWeight: "800" },
  metricLabel: { color: BrandColors.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  factGrid: { gap: 6 },
  factText: { color: BrandColors.inkSoft, fontSize: 13, lineHeight: 18 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: BrandColors.surfaceMuted, borderWidth: 1, borderColor: BrandColors.border },
  textButton: { paddingHorizontal: 10, paddingVertical: 9 },
  textButtonLabel: { color: BrandColors.blue, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  statusPill: { borderRadius: 999, backgroundColor: BrandColors.surfaceMuted, borderWidth: 1, borderColor: BrandColors.border, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: BrandColors.inkSoft, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  directoryRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: BrandColors.border, paddingVertical: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: BrandColors.border, paddingTop: 12 },
  directoryCopy: { flex: 1, gap: 2 },
  rowTitle: { color: BrandColors.ink, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  rowMeta: { color: BrandColors.muted, fontSize: 12, lineHeight: 17 },
  countBadge: { minWidth: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(42,109,230,0.1)" },
  countBadgeText: { color: BrandColors.blue, fontSize: 12, fontWeight: "800" },
  primaryButton: { minHeight: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: BrandColors.blueDeep, paddingHorizontal: 16, paddingVertical: 13 },
  primaryButtonPressed: { opacity: 0.84 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  buttonDisabled: { opacity: 0.48 },
  resultCard: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 16, backgroundColor: BrandColors.successBg, borderWidth: 1, borderColor: BrandColors.successBorder, padding: 12 },
  resultText: { flex: 1, color: BrandColors.successText, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: BrandColors.dangerBg, borderWidth: 1, borderColor: BrandColors.dangerBorder, padding: 14 },
  errorText: { flex: 1, color: BrandColors.dangerText, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  retryButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: "#FFFFFF" },
  retryButtonText: { color: BrandColors.dangerText, fontSize: 13, fontWeight: "800" },
  accessState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 28 },
  accessTitle: { color: BrandColors.ink, fontSize: 20, lineHeight: 26, fontWeight: "800" },
  skeletonWrap: { gap: 12 },
  skeletonMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  skeletonMetric: { minWidth: 92, flexGrow: 1, borderRadius: 17, backgroundColor: "rgba(98,113,150,0.08)", padding: 13, gap: 8 },
  skeletonValue: { width: 42, height: 20, borderRadius: 7, backgroundColor: "rgba(98,113,150,0.18)" },
  skeletonLabel: { width: 66, height: 10, borderRadius: 5, backgroundColor: "rgba(98,113,150,0.12)" },
  skeletonLineWide: { width: "84%", height: 11, borderRadius: 6, backgroundColor: "rgba(98,113,150,0.14)" },
  skeletonLine: { width: "58%", height: 11, borderRadius: 6, backgroundColor: "rgba(98,113,150,0.1)" },
});
