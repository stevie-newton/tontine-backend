import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

type Payout = {
  id: number;
  tontine_id: number;
  cycle_id: number;
  membership_id: number;
  amount: string | number;
  is_processed: boolean;
  processed_at: string | null;
  created_at: string;
  member_name?: string | null;
  member_phone?: string | null;
  cycle_number?: number | null;
  tontine_name?: string | null;
};

type PayoutSummary = {
  total_payouts: number;
  processed_count: number;
  pending_count: number;
  total_amount: string | number;
  last_payout_date: string | null;
};

type PayoutFilter = "all" | "pending" | "processed";

function formatAmount(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(getCurrentLocale(), { maximumFractionDigits: 2 }).format(n);
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function PayoutsScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const id = useMemo(() => Number(tontineId), [tontineId]);
  const { t } = useI18n();

  const [items, setItems] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<PayoutFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [listRes, sumRes] = await Promise.all([
        api.get<Payout[]>(`/payouts/tontine/${id}`),
        api.get<PayoutSummary>(`/payouts/summary/tontine/${id}`),
      ]);
      setItems(listRes.data ?? []);
      setSummary(sumRes.data ?? null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(id)) {
        setIsLoading(false);
        setError(t("Invalid tontine id."));
        return;
      }
      void load();
    }, [id, load, t])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
  }

  const processedRate = useMemo(() => {
    if (!summary?.total_payouts) return 0;
    return Math.round((summary.processed_count / summary.total_payouts) * 100);
  }, [summary]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) =>
      filter === "processed" ? item.is_processed : !item.is_processed
    );
  }, [filter, items]);

  const filters: { key: PayoutFilter; label: string }[] = [
    { key: "all", label: t("All") },
    { key: "pending", label: t("Pending") },
    { key: "processed", label: t("Processed") },
  ];

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: t("Payouts") }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryHeading}>
                <ThemedText style={styles.summaryLabel}>{t("Total payout value")}</ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {formatAmount(summary?.total_amount ?? 0)}
                </ThemedText>
              </View>
              <View style={styles.entryBadge}>
                <ThemedText style={styles.entryBadgeText}>
                  {t("{{count}} payouts", { count: summary?.total_payouts ?? 0 })}
                </ThemedText>
              </View>
            </View>

            <View style={styles.summaryMetrics}>
              <View style={styles.summaryMetric}>
                <ThemedText style={styles.summaryMetricValue}>
                  {summary?.processed_count ?? 0}
                </ThemedText>
                <ThemedText style={styles.summaryMetricLabel}>{t("Processed")}</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryMetric}>
                <ThemedText style={styles.summaryMetricValue}>{summary?.pending_count ?? 0}</ThemedText>
                <ThemedText style={styles.summaryMetricLabel}>{t("Pending")}</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryMetric}>
                <ThemedText style={styles.summaryMetricValue}>{processedRate}%</ThemedText>
                <ThemedText style={styles.summaryMetricLabel}>{t("Processed rate")}</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">{t("History")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t("{{count}} records", { count: filteredItems.length })}
              </ThemedText>
            </View>

            <View style={styles.filterRow} accessibilityRole="tablist">
              {filters.map((option) => {
                const isActive = option.key === filter;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setFilter(option.key)}
                    style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                  >
                    <ThemedText
                      style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>{t("No matching payouts")}</ThemedText>
                <ThemedText style={styles.supportText}>
                  {t("Try another filter or check back as payout records are updated.")}
                </ThemedText>
              </View>
            ) : (
              filteredItems.map((item) => (
                <View key={item.id} style={styles.payoutCard}>
                  <View style={styles.payoutHeader}>
                    <View style={styles.payoutHeading}>
                      <ThemedText style={styles.payoutTitle}>
                        {item.member_name ?? t("Member")}
                      </ThemedText>
                      <ThemedText style={styles.supportText}>
                        {t("Cycle {{number}}", { number: item.cycle_number ?? item.cycle_id ?? "-" })}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        item.is_processed ? styles.statusBadgeCool : styles.statusBadgeWarm,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusBadgeText,
                          item.is_processed
                            ? styles.statusBadgeCoolText
                            : styles.statusBadgeWarmText,
                        ]}
                      >
                        {item.is_processed ? t("processed") : t("pending")}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.metricGrid}>
                    <View style={styles.metricTileCompact}>
                      <ThemedText style={styles.metricValueCompact}>
                        {formatAmount(item.amount)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Amount")}</ThemedText>
                    </View>
                    <View style={styles.metricTileCompact}>
                      <ThemedText style={styles.metricValueCompact}>
                        {formatShortDate(item.is_processed ? item.processed_at : item.created_at)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>
                        {item.is_processed ? t("Processed on") : t("Created on")}
                      </ThemedText>
                    </View>
                  </View>

                  {item.member_phone ? (
                    <ThemedText style={styles.supportText}>{item.member_phone}</ThemedText>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 18,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 18,
    ...BrandShadow,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryHeading: {
    flex: 1,
    gap: 3,
  },
  summaryLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  summaryValue: {
    color: BrandColors.ink,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "800",
  },
  entryBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(46,207,227,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryBadgeText: {
    color: BrandColors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  summaryMetrics: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  summaryMetric: {
    flex: 1,
    gap: 3,
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: 10,
    backgroundColor: BrandColors.border,
  },
  summaryMetricValue: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  summaryMetricLabel: {
    color: BrandColors.muted,
    fontSize: 11,
    lineHeight: 15,
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: BrandColors.blueDeep,
    borderColor: BrandColors.blueDeep,
  },
  filterChipText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  metricGrid: {
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
  metricTileCompact: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 12,
    gap: 2,
  },
  metricValue: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  metricValueCompact: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  metricLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  payoutCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  payoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  payoutHeading: {
    flex: 1,
    gap: 2,
  },
  payoutTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeCool: {
    backgroundColor: "#ECFDF3",
    borderColor: "#ABEFC6",
  },
  statusBadgeWarm: {
    backgroundColor: "#FFFAEB",
    borderColor: "#FEDF89",
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statusBadgeCoolText: {
    color: "#067647",
  },
  statusBadgeWarmText: {
    color: "#B54708",
  },
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    gap: 8,
  },
  emptyTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  error: {
    color: BrandColors.dangerText,
    fontWeight: "700",
    fontSize: 14,
    paddingHorizontal: 4,
  },
});
