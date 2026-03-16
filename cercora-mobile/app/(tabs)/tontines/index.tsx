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
import { getCurrentLocale } from "@/hooks/use-i18n";

type Tontine = {
  id: number;
  name: string;
  contribution_amount: number;
  frequency: "weekly" | "monthly" | string;
  total_cycles: number;
  current_cycle: number;
  status: "draft" | "active" | "completed" | string;
  owner_id: number;
  created_at: string;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    maximumFractionDigits: 2,
  }).format(value);
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
  const [items, setItems] = useState<Tontine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Tontine[]>("/tontines");
      setItems(res.data);
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

  const summary = useMemo(() => {
    const active = items.filter((item) => item.status === "active").length;
    const draft = items.filter((item) => item.status === "draft").length;
    const monthly = items.filter((item) => item.frequency === "monthly").length;

    return {
      total: items.length,
      active,
      draft,
      monthly,
    };
  }, [items]);

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <FlatList
        data={items}
        keyExtractor={(t) => String(t.id)}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.hero}>
              <View style={styles.heroGlowTop} />
              <View style={styles.heroGlowBottom} />
              <ThemedText style={styles.eyebrow}>Savings circles</ThemedText>
              <ThemedText style={styles.heroTitle}>Your tontines</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Create, organize, and track each circle from a single place.
              </ThemedText>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <ThemedText style={styles.heroStatValue}>
                    {isLoading ? "..." : String(summary.total)}
                  </ThemedText>
                  <ThemedText style={styles.heroStatLabel}>Total groups</ThemedText>
                </View>
                <View style={styles.heroStat}>
                  <ThemedText style={styles.heroStatValue}>
                    {isLoading ? "..." : String(summary.active)}
                  </ThemedText>
                  <ThemedText style={styles.heroStatLabel}>Active now</ThemedText>
                </View>
                <View style={styles.heroStat}>
                  <ThemedText style={styles.heroStatValue}>
                    {isLoading ? "..." : String(summary.monthly)}
                  </ThemedText>
                  <ThemedText style={styles.heroStatLabel}>Monthly</ThemedText>
                </View>
              </View>

              <Link href="/(tabs)/tontines/create" asChild>
                <Pressable style={styles.heroButton}>
                  <ThemedText style={styles.heroButtonText}>Start a tontine</ThemedText>
                </Pressable>
              </Link>
            </View>

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            {!isLoading ? (
              <View style={styles.summaryStrip}>
                <View style={styles.summaryChip}>
                  <ThemedText style={styles.summaryChipValue}>{summary.draft}</ThemedText>
                  <ThemedText style={styles.summaryChipLabel}>Draft</ThemedText>
                </View>
                <View style={styles.summaryChip}>
                  <ThemedText style={styles.summaryChipValue}>{summary.active}</ThemedText>
                  <ThemedText style={styles.summaryChipLabel}>Active</ThemedText>
                </View>
                <View style={styles.summaryChip}>
                  <ThemedText style={styles.summaryChipValue}>
                    {summary.total - summary.active - summary.draft}
                  </ThemedText>
                  <ThemedText style={styles.summaryChipLabel}>Completed</ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator />
              <ThemedText style={styles.supportText}>Loading your tontines...</ThemedText>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>No tontines yet</ThemedText>
              <ThemedText style={styles.supportText}>
                Start your first circle to invite members, generate cycles, and track contributions.
              </ThemedText>
              <Link href="/(tabs)/tontines/create" asChild>
                <Pressable style={styles.primaryButton}>
                  <ThemedText style={styles.primaryButtonText}>Create first tontine</ThemedText>
                </Pressable>
              </Link>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const tone = getStatusTone(item.status);

          return (
            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]",
                params: { tontineId: String(item.id) },
              }}
              asChild
            >
              <Pressable style={[styles.card, index === 0 ? styles.cardFeatured : null]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleWrap}>
                    <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
                    <ThemedText style={styles.cardMeta}>
                      {item.frequency} cadence
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: tone.bg, borderColor: tone.border },
                    ]}
                  >
                    <ThemedText style={[styles.statusBadgeText, { color: tone.text }]}>
                      {item.status}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricBox}>
                    <ThemedText style={styles.metricValue}>
                      {formatAmount(item.contribution_amount)}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>Contribution</ThemedText>
                  </View>
                  <View style={styles.metricBox}>
                    <ThemedText style={styles.metricValue}>
                      {item.current_cycle}/{item.total_cycles}
                    </ThemedText>
                    <ThemedText style={styles.metricLabel}>Cycle progress</ThemedText>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <ThemedText style={styles.supportText}>
                    Open workspace
                  </ThemedText>
                  <ThemedText style={styles.cardArrow}>View</ThemedText>
                </View>
              </Pressable>
            </Link>
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
    paddingBottom: 120,
    gap: 14,
  },
  headerWrap: {
    gap: 14,
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
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.28,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -12,
    bottom: -50,
    width: 140,
    height: 140,
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
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#E6EEFF",
    fontSize: 15,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  heroStat: {
    minWidth: 96,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 14,
    gap: 5,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
  },
  heroButton: {
    alignSelf: "flex-start",
    borderRadius: 16,
    backgroundColor: BrandColors.surfaceStrong,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  heroButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "800",
    fontSize: 14,
  },
  summaryStrip: {
    flexDirection: "row",
    gap: 10,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 4,
    ...BrandShadow,
  },
  summaryChipValue: {
    color: BrandColors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  summaryChipLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingState: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyState: {
    borderRadius: 28,
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
  primaryButton: {
    borderRadius: 16,
    backgroundColor: BrandColors.blueDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
    ...BrandShadow,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
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
  cardFeatured: {
    borderColor: BrandColors.borderStrong,
    backgroundColor: "rgba(46,207,227,0.08)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  cardMeta: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
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
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
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
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  cardArrow: {
    color: BrandColors.inkSoft,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  error: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
