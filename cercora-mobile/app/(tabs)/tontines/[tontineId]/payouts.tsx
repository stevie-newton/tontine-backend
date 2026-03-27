import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
        setError("Invalid tontine id.");
        return;
      }
      void load();
    }, [id, load])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
  }

  const processedRate = useMemo(() => {
    if (!summary?.total_payouts) return 0;
    return Math.round((summary.processed_count / summary.total_payouts) * 100);
  }, [summary]);

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
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>Payout ledger</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              The mobile payout view now follows the rebuilt tontine workflow, with summary, processing state, and full payout history in one place.
            </ThemedText>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>Payout history</ThemedText>
            <ThemedText style={styles.heroTitle}>Member payouts</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Review who received each payout, what is still pending, and how much has moved out of the tontine.
            </ThemedText>

            <View style={styles.heroBadges}>
              <View style={styles.heroBadgeCool}>
                <ThemedText style={styles.heroBadgeCoolText}>
                  {summary?.processed_count ?? 0} processed
                </ThemedText>
              </View>
              <View style={styles.heroBadgeWarm}>
                <ThemedText style={styles.heroBadgeWarmText}>
                  {summary?.pending_count ?? 0} pending
                </ThemedText>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{summary?.total_payouts ?? 0}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Total payouts</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {formatAmount(summary?.total_amount ?? 0)}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Total value</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{processedRate}%</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Processed rate</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.card}>
            <ThemedText type="subtitle">Payout pulse</ThemedText>
            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>
                  {summary?.last_payout_date ? formatShortDate(summary.last_payout_date) : "None"}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Last payout</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{summary?.pending_count ?? 0}</ThemedText>
                <ThemedText style={styles.metricLabel}>Still pending</ThemedText>
              </View>
            </View>
            <View style={styles.metricGrid}>
              <View style={styles.metricTileCompact}>
                <ThemedText style={styles.metricValueCompact}>{summary?.processed_count ?? 0}</ThemedText>
                <ThemedText style={styles.metricLabel}>Processed entries</ThemedText>
              </View>
              <View style={styles.metricTileCompact}>
                <ThemedText style={styles.metricValueCompact}>{summary?.pending_count ?? 0}</ThemedText>
                <ThemedText style={styles.metricLabel}>Awaiting processing</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">History</ThemedText>
              <ThemedText style={styles.supportText}>{items.length} records</ThemedText>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No payouts yet</ThemedText>
                <ThemedText style={styles.supportText}>
                  Payout records will appear here as cycles close and beneficiaries are processed.
                </ThemedText>
              </View>
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.payoutCard}>
                  <View style={styles.payoutHeader}>
                    <View style={styles.payoutHeading}>
                      <ThemedText style={styles.payoutTitle}>
                        {item.member_name ?? "Member"}
                      </ThemedText>
                      <ThemedText style={styles.supportText}>
                        Cycle {item.cycle_number ?? item.cycle_id}
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
                        {item.is_processed ? "processed" : "pending"}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.metricGrid}>
                    <View style={styles.metricTileCompact}>
                      <ThemedText style={styles.metricValueCompact}>
                        {formatAmount(item.amount)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Amount</ThemedText>
                    </View>
                    <View style={styles.metricTileCompact}>
                      <ThemedText style={styles.metricValueCompact}>
                        {formatShortDate(item.is_processed ? item.processed_at : item.created_at)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>
                        {item.is_processed ? "Processed on" : "Created on"}
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
  pageHeader: {
    gap: 6,
  },
  pageTitle: {
    color: BrandColors.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: BrandColors.blueDeep,
    padding: 22,
    gap: 14,
    ...BrandShadow,
  },
  heroGlowTop: {
    position: "absolute",
    top: -32,
    right: -24,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.25,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -20,
    bottom: -54,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.14,
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
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#E6EEFF",
    fontSize: 15,
    lineHeight: 22,
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroBadgeCool: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(171, 239, 198, 0.38)",
    backgroundColor: "rgba(236, 253, 243, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeCoolText: {
    color: "#D9FBE8",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroBadgeWarm: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(138, 55, 201, 0.36)",
    backgroundColor: "rgba(138, 55, 201, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeWarmText: {
    color: "#F0D9FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStat: {
    minWidth: 100,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
    gap: 4,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
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
