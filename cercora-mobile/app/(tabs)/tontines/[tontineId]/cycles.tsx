import { useFocusEffect } from "@react-navigation/native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
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
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

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

type Cycle = {
  id: number;
  tontine_id: number;
  cycle_number: number;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_at: string | null;
  created_at: string;
  payout_member_id: number | null;
  payout_member_name?: string | null;
  payout_member_phone?: string | null;
};

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function TontineCyclesScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const id = useMemo(() => Number(tontineId), [tontineId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tontineRes, cyclesRes] = await Promise.all([
        api.get<Tontine>(`/tontines/${id}`),
        api.get<Cycle[]>(`/tontine-cycles/tontine/${id}`),
      ]);
      setTontine(tontineRes.data);
      setCycles(cyclesRes.data ?? []);
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

  const isOwner = !!tontine && !!user && tontine.owner_id === user.id;
  const openCycles = cycles.filter((cycle) => !cycle.is_closed);
  const closedCycles = cycles.filter((cycle) => cycle.is_closed);
  const nextCycle = cycles.find((cycle) => cycle.cycle_number === tontine?.current_cycle) ?? null;

  async function onGenerateCycles() {
    setError(null);
    setIsGenerating(true);
    try {
      await api.post(`/tontine-cycles/generate/${id}`);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: t("Cycles") }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>Cycle planner</ThemedText>
            <ThemedText style={styles.heroTitle}>
              {tontine?.name ?? "Tontine"} cycles
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Track the full rotation, open the current cycle, and generate the schedule when the owner is ready.
            </ThemedText>

            <View style={styles.heroBadges}>
              <View style={styles.heroBadgeCool}>
                <ThemedText style={styles.heroBadgeCoolText}>{openCycles.length} open</ThemedText>
              </View>
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>{closedCycles.length} closed</ThemedText>
              </View>
              {isOwner ? (
                <View style={styles.heroBadgeWarm}>
                  <ThemedText style={styles.heroBadgeWarmText}>Owner controls</ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{cycles.length}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Generated cycles</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {tontine ? `${tontine.current_cycle}/${tontine.total_cycles}` : "-"}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Progress</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {nextCycle ? `Cycle ${nextCycle.cycle_number}` : "None"}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Current focus</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          {isOwner ? (
            <Pressable
              style={styles.primaryAction}
              disabled={isGenerating}
              onPress={() => void onGenerateCycles()}
            >
              <ThemedText style={styles.primaryActionText}>
                {isGenerating ? "Generating..." : "Generate cycles"}
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.card}>
            <ThemedText type="subtitle">Cycle overview</ThemedText>
            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{openCycles.length}</ThemedText>
                <ThemedText style={styles.metricLabel}>Open now</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{closedCycles.length}</ThemedText>
                <ThemedText style={styles.metricLabel}>Archived</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>
                  {nextCycle?.payout_member_name ?? "Pending"}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Current payout</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">All cycles</ThemedText>
              <ThemedText style={styles.supportText}>{cycles.length} total</ThemedText>
            </View>

            {cycles.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No cycles yet</ThemedText>
                <ThemedText style={styles.supportText}>
                  {isOwner
                    ? "Generate cycles to begin contributions, payouts, and the full rotation."
                    : "Ask the owner to generate cycles before contributions can start."}
                </ThemedText>
              </View>
            ) : (
              cycles.map((item) => (
                <Link
                  key={item.id}
                  href={{
                    pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]",
                    params: { tontineId: String(id), cycleId: String(item.id) },
                  }}
                  asChild
                >
                  <Pressable style={styles.cycleCard}>
                    <View style={styles.cycleHeader}>
                      <View style={styles.cycleHeading}>
                        <ThemedText style={styles.cycleTitle}>Cycle {item.cycle_number}</ThemedText>
                        <ThemedText style={styles.supportText}>
                          {formatShortDate(item.start_date)} to {formatShortDate(item.end_date)}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          item.is_closed ? styles.statusBadgeNeutral : styles.statusBadgeCool,
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.statusBadgeText,
                            item.is_closed
                              ? styles.statusBadgeNeutralText
                              : styles.statusBadgeCoolText,
                          ]}
                        >
                          {item.is_closed ? "closed" : "open"}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>
                          {item.payout_member_name ?? "Unassigned"}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>Payout member</ThemedText>
                      </View>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>
                          {item.closed_at ? formatShortDate(item.closed_at) : "Still open"}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>Closed at</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                </Link>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    top: -28,
    right: -18,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.25,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -14,
    bottom: -58,
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
  heroBadgeNeutral: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeNeutralText: {
    color: "#EFF6FF",
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
  primaryAction: {
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 14,
    alignItems: "center",
    ...BrandShadow,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "800",
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  supportText: {
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
  cycleCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  cycleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cycleHeading: {
    flex: 1,
    gap: 2,
  },
  cycleTitle: {
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
  statusBadgeNeutral: {
    backgroundColor: "#F2F4F7",
    borderColor: "#D0D5DD",
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
  statusBadgeNeutralText: {
    color: "#344054",
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
