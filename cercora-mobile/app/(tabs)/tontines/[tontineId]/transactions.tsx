import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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

type Transaction = {
  id: number;
  tontine_id: number;
  tontine_name?: string | null;
  cycle_id: number | null;
  cycle_number?: number | null;
  membership_id: number | null;
  user_id?: number | null;
  user_name?: string | null;
  user_phone?: string | null;
  entry_type: string;
  amount: string | number;
  description?: string | null;
  created_at: string;
};

type TransactionSummary = {
  total_contributions: string | number;
  total_payouts: string | number;
  total_fees: string | number;
  balance: string | number;
  transaction_count: number;
  last_transaction_date: string | null;
};

type TransactionFilter = "all" | "contribution" | "payout" | "fee" | "other";

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

function getTypeMeta(entryType: string) {
  const value = (entryType || "").toLowerCase();
  if (value === "contribution") {
    return {
      label: "contribution",
      bg: "#ECFDF3",
      border: "#ABEFC6",
      text: "#067647",
    };
  }
  if (value === "payout") {
    return {
      label: "payout",
      bg: "#FEF3F2",
      border: "#FECDCA",
      text: "#B42318",
    };
  }
  if (value === "fee") {
    return {
      label: "fee",
      bg: "#FFF7ED",
      border: "#FED7AA",
      text: "#B54708",
    };
  }
  if (value === "refund") {
    return {
      label: "refund",
      bg: "#EEF4FF",
      border: "#B2DDFF",
      text: "#175CD3",
    };
  }
  return {
    label: value || "adjustment",
    bg: "#F2F4F7",
    border: "#D0D5DD",
    text: "#344054",
  };
}

export default function TransactionsScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const id = useMemo(() => Number(tontineId), [tontineId]);
  const { t } = useI18n();

  const [items, setItems] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [listRes, sumRes] = await Promise.all([
        api.get<Transaction[]>(`/transactions/tontine/${id}`),
        api.get<TransactionSummary>(`/transactions/tontine/${id}/summary`),
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

  async function onExportCsv() {
    setError(null);
    setIsExporting(true);
    try {
      const response = await api.get<string>(`/transactions/tontine/${id}/export/csv`, {
        responseType: "text",
      });
      const fileUri = `${FileSystem.cacheDirectory}tontine_${id}_ledger.csv`;
      await FileSystem.writeAsStringAsync(fileUri, response.data, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const shareUri =
        Platform.OS === "android" ? await FileSystem.getContentUriAsync(fileUri) : fileUri;
      await Share.share({
        url: shareUri,
        title: t("transactions.export_title"),
        message: `tontine_${id}_ledger.csv`,
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsExporting(false);
    }
  }

  const contributionTotal = Number(summary?.total_contributions ?? 0);
  const payoutTotal = Number(summary?.total_payouts ?? 0);
  const balanceTone = Number(summary?.balance ?? 0) >= 0 ? styles.balanceGood : styles.balanceWarn;
  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "other") {
      return items.filter(
        (item) => !["contribution", "payout", "fee"].includes(item.entry_type.toLowerCase())
      );
    }
    return items.filter((item) => item.entry_type.toLowerCase() === filter);
  }, [filter, items]);

  const filters: { key: TransactionFilter; label: string }[] = [
    { key: "all", label: t("All") },
    { key: "contribution", label: t("Contributions") },
    { key: "payout", label: t("Payouts") },
    { key: "fee", label: t("Fees") },
    { key: "other", label: t("Other") },
  ];

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: t("Transactions") }} />

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
                <ThemedText style={styles.summaryLabel}>{t("Current balance")}</ThemedText>
                <ThemedText style={[styles.balanceValue, balanceTone]}>
                  {formatAmount(summary?.balance ?? 0)}
                </ThemedText>
              </View>
              <View style={styles.entryBadge}>
                <ThemedText style={styles.entryBadgeText}>
                  {t("{{count}} entries", { count: summary?.transaction_count ?? 0 })}
                </ThemedText>
              </View>
            </View>

            <View style={styles.summaryMetrics}>
              <View style={styles.summaryMetric}>
                <ThemedText style={styles.summaryMetricValue}>{formatAmount(contributionTotal)}</ThemedText>
                <ThemedText style={styles.summaryMetricLabel}>{t("Contributions")}</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryMetric}>
                <ThemedText style={styles.summaryMetricValue}>{formatAmount(payoutTotal)}</ThemedText>
                <ThemedText style={styles.summaryMetricLabel}>{t("Payouts")}</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryMetric}>
                <ThemedText style={styles.summaryMetricValue}>
                  {formatAmount(summary?.total_fees ?? 0)}
                </ThemedText>
                <ThemedText style={styles.summaryMetricLabel}>{t("Fees")}</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">{t("History")}</ThemedText>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.exportButton}
                  disabled={isExporting}
                  onPress={() => void onExportCsv()}
                >
                  <ThemedText style={styles.exportButtonText}>
                    {isExporting ? t("transactions.exporting") : t("transactions.export_csv")}
                  </ThemedText>
                </Pressable>
                <ThemedText style={styles.supportText}>
                  {t("{{count}} transactions", { count: filteredItems.length })}
                </ThemedText>
              </View>
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
                <ThemedText style={styles.emptyTitle}>{t("No matching transactions")}</ThemedText>
                <ThemedText style={styles.supportText}>
                  {t("Try another filter or check back when new ledger activity is recorded.")}
                </ThemedText>
              </View>
            ) : (
              filteredItems.map((item) => {
                const meta = getTypeMeta(item.entry_type);
                return (
                  <View key={item.id} style={styles.transactionCard}>
                    <View style={styles.transactionHeader}>
                      <View style={styles.transactionHeading}>
                        <ThemedText style={styles.transactionTitle}>{t(meta.label)}</ThemedText>
                        <ThemedText style={styles.supportText}>
                          {item.cycle_number ? t("Cycle {{number}}", { number: item.cycle_number }) : t("General entry")}
                          {item.user_name ? ` • ${item.user_name}` : ""}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: meta.bg, borderColor: meta.border },
                        ]}
                      >
                        <ThemedText style={[styles.typeBadgeText, { color: meta.text }]}>
                          {t(meta.label)}
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
                          {formatShortDate(item.created_at)}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>{t("Posted on")}</ThemedText>
                      </View>
                    </View>

                    {item.description ? (
                      <ThemedText style={styles.supportText}>{item.description}</ThemedText>
                    ) : null}
                    {item.user_phone ? (
                      <ThemedText style={styles.supportText}>{item.user_phone}</ThemedText>
                    ) : null}
                  </View>
                );
              })
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
  balanceValue: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "800",
  },
  balanceGood: {
    color: BrandColors.ink,
  },
  balanceWarn: {
    color: BrandColors.dangerText,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exportButton: {
    borderRadius: 999,
    backgroundColor: "rgba(46,207,227,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exportButtonText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
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
  transactionCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  transactionHeading: {
    flex: 1,
    gap: 2,
  },
  transactionTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  typeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
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
