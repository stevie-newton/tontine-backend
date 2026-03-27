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
import { useAuth } from "@/hooks/use-auth";
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

type Tontine = {
  id: number;
  owner_id: number;
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
  const { user } = useAuth();

  const [items, setItems] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [listRes, sumRes, tontineRes] = await Promise.all([
        api.get<Transaction[]>(`/transactions/tontine/${id}`),
        api.get<TransactionSummary>(`/transactions/tontine/${id}/summary`),
        api.get<Tontine>(`/tontines/${id}`),
      ]);
      setItems(listRes.data ?? []);
      setSummary(sumRes.data ?? null);
      setTontine(tontineRes.data ?? null);
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
        title: `tontine_${id}_ledger.csv`,
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
  const isOwner = !!user && !!tontine && user.id === tontine.owner_id;

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
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>Transaction ledger</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              This view stays linked to the backend ledger routes while matching the newer tontine workspace structure.
            </ThemedText>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>Ledger</ThemedText>
            <ThemedText style={styles.heroTitle}>Transaction flow</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Follow every contribution, payout, fee, and adjustment moving through this tontine.
            </ThemedText>

            <View style={styles.balanceCard}>
              <ThemedText style={styles.balanceLabel}>Current balance</ThemedText>
              <ThemedText style={[styles.balanceValue, balanceTone]}>
                {formatAmount(summary?.balance ?? 0)}
              </ThemedText>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{summary?.transaction_count ?? 0}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Entries</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{formatAmount(contributionTotal)}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Contributions</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{formatAmount(payoutTotal)}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Payouts</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.card}>
            <ThemedText type="subtitle">Ledger pulse</ThemedText>
            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>
                  {formatAmount(summary?.total_fees ?? 0)}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Fees</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>
                  {summary?.last_transaction_date
                    ? formatShortDate(summary.last_transaction_date)
                    : "None"}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Last entry</ThemedText>
              </View>
            </View>
            <View style={styles.metricGrid}>
              <View style={styles.metricTileCompact}>
                <ThemedText style={styles.metricValueCompact}>
                  {formatAmount(summary?.total_contributions ?? 0)}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Contribution volume</ThemedText>
              </View>
              <View style={styles.metricTileCompact}>
                <ThemedText style={styles.metricValueCompact}>
                  {formatAmount(summary?.total_payouts ?? 0)}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Payout volume</ThemedText>
              </View>
              <View style={styles.metricTileCompact}>
                <ThemedText style={styles.metricValueCompact}>
                  {formatAmount(summary?.total_fees ?? 0)}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Fees</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">History</ThemedText>
              <View style={styles.headerActions}>
                {isOwner ? (
                  <Pressable
                    style={styles.exportButton}
                    disabled={isExporting}
                    onPress={() => void onExportCsv()}
                  >
                    <ThemedText style={styles.exportButtonText}>
                      {isExporting ? "Exporting..." : "Export CSV"}
                    </ThemedText>
                  </Pressable>
                ) : null}
                <ThemedText style={styles.supportText}>{items.length} transactions</ThemedText>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No transactions yet</ThemedText>
                <ThemedText style={styles.supportText}>
                  Ledger activity will appear here as contributions, payouts, and fees are recorded.
                </ThemedText>
              </View>
            ) : (
              items.map((item) => {
                const meta = getTypeMeta(item.entry_type);
                return (
                  <View key={item.id} style={styles.transactionCard}>
                    <View style={styles.transactionHeader}>
                      <View style={styles.transactionHeading}>
                        <ThemedText style={styles.transactionTitle}>{meta.label}</ThemedText>
                        <ThemedText style={styles.supportText}>
                          {item.cycle_number ? `Cycle ${item.cycle_number}` : "General entry"}
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
                          {meta.label}
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
                          {formatShortDate(item.created_at)}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>Posted on</ThemedText>
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
    top: -34,
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
    bottom: -52,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.15,
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
  balanceCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 16,
    gap: 4,
  },
  balanceLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
  },
  balanceValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  balanceGood: {
    color: "#FFFFFF",
  },
  balanceWarn: {
    color: "#FFE7CC",
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
