import { useFocusEffect } from "@react-navigation/native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

type Member = {
  membership_id: number;
  id: number;
  name: string;
  phone: string;
  membership_role: string;
  membership_status: "active" | "pending" | string;
  payout_position: number | null;
  rotation_position: number | null;
  joined_at: string;
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

type ContributionSummary = {
  tontine_id: number;
  cycle_id: number | null;
  total_members: number;
  total_contributions: number;
  confirmed_contributions: number;
  pending_contributions: number;
  total_amount: string | number;
  average_per_member: string | number;
  last_contribution_date?: string | null;
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

function formatAmount(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(getCurrentLocale(), { maximumFractionDigits: 2 }).format(n);
}

function getStatusTone(status: string) {
  const value = status.toLowerCase();
  if (value === "active") {
    return {
      bg: "rgba(236, 253, 243, 0.14)",
      border: "rgba(171, 239, 198, 0.45)",
      text: "#D9FBE8",
      lightBg: "#ECFDF3",
      lightBorder: "#ABEFC6",
      lightText: "#067647",
    };
  }
  if (value === "completed") {
    return {
      bg: "rgba(242, 244, 247, 0.18)",
      border: "rgba(255, 255, 255, 0.18)",
      text: "#F8FAFC",
      lightBg: "#F2F4F7",
      lightBorder: "#D0D5DD",
      lightText: "#344054",
    };
  }
  return {
    bg: "rgba(255, 247, 237, 0.14)",
    border: "rgba(254, 215, 170, 0.4)",
    text: "#FFE7CC",
    lightBg: "#FFF7ED",
    lightBorder: "#FED7AA",
    lightText: "#B54708",
  };
}

export default function TontineDetailScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const id = useMemo(() => Number(tontineId), [tontineId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [summary, setSummary] = useState<ContributionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const tontineReq = api.get<Tontine>(`/tontines/${id}`);
      const membersReq = api.get<Member[]>(
        `/tontine-memberships/tontine/${id}/members`
      );
      const currentCycleReq = api
        .get<Cycle>(`/tontine-cycles/tontine/${id}/current`)
        .then((r) => r.data)
        .catch(() => null);

      const [tontineRes, membersRes, cycle] = await Promise.all([
        tontineReq,
        membersReq,
        currentCycleReq,
      ]);

      setTontine(tontineRes.data);
      setMembers(membersRes.data);
      setCurrentCycle(cycle);

      if (cycle) {
        try {
          const sumRes = await api.get<ContributionSummary>(
            `/contributions/summary/tontine/${id}`,
            { params: { cycle_id: cycle.id } }
          );
          setSummary(sumRes.data);
        } catch {
          setSummary(null);
        }
      } else {
        setSummary(null);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
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

  const activeMembers = members.filter((member) => member.membership_status === "active");
  const pendingMembers = members.filter((member) => member.membership_status !== "active");
  const myMembership = user ? members.find((member) => member.id === user.id) ?? null : null;
  const isOwner = !!user && !!tontine && tontine.owner_id === user.id;
  const isAdmin = !!myMembership && myMembership.membership_role === "admin";
  const canManage = isOwner || isAdmin;
  const tone = getStatusTone(tontine?.status ?? "draft");

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: tontine?.name ?? t("Tontine") }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <ThemedText style={styles.error}>{error}</ThemedText>
      ) : tontine ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>Tontine workspace</ThemedText>
            <ThemedText style={styles.heroTitle}>{tontine.name}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Track progress, invite members, and manage the full savings cycle from one place.
            </ThemedText>

            <View style={styles.heroBadges}>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: tone.bg, borderColor: tone.border },
                ]}
              >
                <ThemedText style={[styles.heroBadgeText, { color: tone.text }]}>
                  {tontine.status}
                </ThemedText>
              </View>
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>{tontine.frequency}</ThemedText>
              </View>
              {canManage ? (
                <View style={styles.heroBadgeAdmin}>
                  <ThemedText style={styles.heroBadgeAdminText}>
                    {isOwner ? "Owner" : "Admin"}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {formatAmount(tontine.contribution_amount)}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Contribution</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {tontine.current_cycle}/{tontine.total_cycles}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Cycle progress</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {activeMembers.length}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Active members</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.actionGrid}>
            {canManage ? (
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/invite",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.primaryAction}>
                  <ThemedText style={styles.primaryActionText}>Invite member</ThemedText>
                </Pressable>
              </Link>
            ) : null}

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/cycles",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable style={styles.secondaryAction}>
                <ThemedText style={styles.secondaryActionText}>Cycles</ThemedText>
              </Pressable>
            </Link>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/members",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable style={styles.secondaryAction}>
                <ThemedText style={styles.secondaryActionText}>Members</ThemedText>
              </Pressable>
            </Link>

            <Link href="./transactions" asChild>
              <Pressable style={styles.secondaryAction}>
                <ThemedText style={styles.secondaryActionText}>Transactions</ThemedText>
              </Pressable>
            </Link>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Current cycle</ThemedText>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/cycles",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>View all</ThemedText>
                </Pressable>
              </Link>
            </View>

            {currentCycle ? (
              <>
                <View style={styles.currentCycleBanner}>
                  <ThemedText style={styles.currentCycleLabel}>
                    Cycle {currentCycle.cycle_number}
                  </ThemedText>
                  <ThemedText style={styles.currentCycleMeta}>
                    {currentCycle.is_closed ? "Closed" : "Open"} - {formatShortDate(currentCycle.start_date)} to {formatShortDate(currentCycle.end_date)}
                  </ThemedText>
                  {currentCycle.payout_member_name ? (
                    <ThemedText style={styles.currentCycleMeta}>
                      Payout member: {currentCycle.payout_member_name}
                    </ThemedText>
                  ) : null}
                </View>

                {summary ? (
                  <View style={styles.metricGrid}>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>
                        {summary.total_contributions}/{summary.total_members}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Submitted</ThemedText>
                    </View>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>
                        {summary.confirmed_contributions}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Confirmed</ThemedText>
                    </View>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>
                        {formatAmount(summary.total_amount)}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>Collected</ThemedText>
                    </View>
                  </View>
                ) : null}

                <Link
                  href={{
                    pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]",
                    params: {
                      tontineId: String(tontine.id),
                      cycleId: String(currentCycle.id),
                    },
                  }}
                  asChild
                >
                  <Pressable style={styles.secondaryButton}>
                    <ThemedText style={styles.secondaryButtonText}>
                      Open current cycle
                    </ThemedText>
                  </Pressable>
                </Link>
              </>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No cycles generated yet</ThemedText>
                <ThemedText style={styles.supportText}>
                  {canManage
                    ? "Go to Cycles and generate them to start tracking contributions and payouts."
                    : "Ask the owner to generate cycles to begin tracking payments."}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Members snapshot</ThemedText>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/members",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>Open</ThemedText>
                </Pressable>
              </Link>
            </View>

            <View style={styles.memberSummaryRow}>
              <View style={styles.memberSummaryTile}>
                <ThemedText style={styles.memberSummaryValue}>{activeMembers.length}</ThemedText>
                <ThemedText style={styles.memberSummaryLabel}>Active</ThemedText>
              </View>
              <View style={styles.memberSummaryTile}>
                <ThemedText style={styles.memberSummaryValue}>{pendingMembers.length}</ThemedText>
                <ThemedText style={styles.memberSummaryLabel}>Pending</ThemedText>
              </View>
              <View style={styles.memberSummaryTile}>
                <ThemedText style={styles.memberSummaryValue}>{canManage ? "Yes" : "No"}</ThemedText>
                <ThemedText style={styles.memberSummaryLabel}>Can manage</ThemedText>
              </View>
            </View>

            {activeMembers.slice(0, 4).map((member) => (
              <View key={member.membership_id} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <ThemedText style={styles.memberName}>{member.name}</ThemedText>
                  <ThemedText style={styles.supportText}>{member.phone}</ThemedText>
                </View>
                <View
                  style={[
                    styles.memberRoleBadge,
                    member.membership_role === "admin"
                      ? styles.memberRoleBadgeAdmin
                      : styles.memberRoleBadgeDefault,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.memberRoleBadgeText,
                      member.membership_role === "admin"
                        ? styles.memberRoleBadgeTextAdmin
                        : styles.memberRoleBadgeTextDefault,
                    ]}
                  >
                    {member.membership_role}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <ThemedText type="subtitle">Explore this tontine</ThemedText>
            <View style={styles.utilityGrid}>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/payouts",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.utilityCard}>
                  <ThemedText style={styles.utilityTitle}>Payouts</ThemedText>
                  <ThemedText style={styles.supportText}>
                    Review payout history and processed totals.
                  </ThemedText>
                </Pressable>
              </Link>

              <Link href="./debts" asChild>
                <Pressable style={styles.utilityCard}>
                  <ThemedText style={styles.utilityTitle}>Debts</ThemedText>
                  <ThemedText style={styles.supportText}>
                    Track open debt coverage and repayment flow.
                  </ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      ) : null}
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
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  heroBadgeNeutral: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeNeutralText: {
    color: "#EAF1FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroBadgeAdmin: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(138, 55, 201, 0.36)",
    backgroundColor: "rgba(138, 55, 201, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeAdminText: {
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
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryAction: {
    minWidth: 145,
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    ...BrandShadow,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryAction: {
    minWidth: 120,
    borderRadius: 18,
    backgroundColor: BrandColors.surfaceStrong,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryActionText: {
    color: BrandColors.inkSoft,
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  linkButton: {
    borderRadius: 999,
    backgroundColor: "rgba(46,207,227,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
  },
  currentCycleBanner: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 16,
    gap: 4,
  },
  currentCycleLabel: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  currentCycleMeta: {
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
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: BrandColors.surfaceStrong,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "800",
    fontSize: 14,
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
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  memberSummaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  memberSummaryTile: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 4,
  },
  memberSummaryValue: {
    color: BrandColors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  memberSummaryLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingTop: 12,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  memberRoleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  memberRoleBadgeAdmin: {
    backgroundColor: "#EFF8FF",
    borderColor: "#B2DDFF",
  },
  memberRoleBadgeDefault: {
    backgroundColor: "#F2F4F7",
    borderColor: "#D0D5DD",
  },
  memberRoleBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  memberRoleBadgeTextAdmin: {
    color: "#175CD3",
  },
  memberRoleBadgeTextDefault: {
    color: "#344054",
  },
  utilityGrid: {
    gap: 10,
  },
  utilityCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 16,
    gap: 6,
  },
  utilityTitle: {
    color: BrandColors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  error: {
    color: BrandColors.dangerText,
    padding: 20,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
