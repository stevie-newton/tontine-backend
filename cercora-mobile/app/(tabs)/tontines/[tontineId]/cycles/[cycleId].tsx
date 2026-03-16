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

type Contribution = {
  id: number;
  membership_id: number;
  cycle_id: number;
  amount: string | number;
  transaction_reference: string;
  proof_screenshot_url?: string | null;
  beneficiary_decision: string;
  is_confirmed: boolean;
  ledger_entry_created: boolean;
  paid_at: string;
  member_name?: string | null;
  member_phone?: string | null;
};

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

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatAmount(value: string | number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat(getCurrentLocale(), { maximumFractionDigits: 2 }).format(num);
}

function getContributionTone(item: Contribution) {
  if (item.is_confirmed) {
    return {
      bg: "#ECFDF3",
      border: "#ABEFC6",
      text: "#067647",
      label: "confirmed",
    };
  }
  if ((item.beneficiary_decision || "").toLowerCase() === "rejected") {
    return {
      bg: "#FEF3F2",
      border: "#FECDCA",
      text: "#B42318",
      label: "rejected",
    };
  }
  return {
    bg: "#FFFAEB",
    border: "#FEDF89",
    text: "#B54708",
    label: "pending",
  };
}

export default function CycleDetailScreen() {
  const { tontineId, cycleId } = useLocalSearchParams<{
    tontineId: string;
    cycleId: string;
  }>();
  const tontineNum = useMemo(() => Number(tontineId), [tontineId]);
  const cycleNum = useMemo(() => Number(cycleId), [cycleId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPayoutUserId, setSelectedPayoutUserId] = useState<number | null>(
    null
  );
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [approvingContributionId, setApprovingContributionId] = useState<number | null>(
    null
  );
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setAdminError(null);
    setAdminMessage(null);
    setApprovalError(null);
    setApprovalMessage(null);

    try {
      const [cycleRes, contribRes, tontineRes, membersRes] = await Promise.all([
        api.get<Cycle>(`/tontine-cycles/${cycleNum}`),
        api.get<Contribution[]>(`/contributions/cycle/${cycleNum}`),
        api.get<Tontine>(`/tontines/${tontineNum}`),
        api.get<Member[]>(`/tontine-memberships/tontine/${tontineNum}/members`),
      ]);

      setCycle(cycleRes.data);
      setContribs(contribRes.data ?? []);
      setTontine(tontineRes.data);
      setMembers(membersRes.data ?? []);
      setSelectedPayoutUserId((prev) => prev ?? (cycleRes.data.payout_member_id ?? null));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cycleNum, tontineNum]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(cycleNum) || !Number.isFinite(tontineNum)) {
        setIsLoading(false);
        setError("Invalid route params.");
        return;
      }
      void load();
    }, [cycleNum, load, tontineNum])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
  }

  const myMembership = user ? members.find((member) => member.id === user.id) ?? null : null;
  const isOwner = !!user && !!tontine && tontine.owner_id === user.id;
  const isAdmin = !!myMembership && myMembership.membership_role === "admin";
  const canManage = isOwner || isAdmin;
  const activeMembers = members.filter((member) => member.membership_status === "active");
  const isCurrentCycle = !!cycle && !!tontine && cycle.cycle_number === tontine.current_cycle;
  const canContribute = !!cycle && !cycle.is_closed && isCurrentCycle;

  const confirmedMemberCount = useMemo(() => {
    const membershipIds = new Set<number>();
    for (const contribution of contribs) {
      if (contribution.is_confirmed) membershipIds.add(contribution.membership_id);
    }
    return membershipIds.size;
  }, [contribs]);

  const allConfirmed =
    activeMembers.length > 0 && confirmedMemberCount === activeMembers.length;
  const canCloseCycle =
    isOwner && Boolean(cycle) && Boolean(tontine) && isCurrentCycle && allConfirmed;

  const collectedAmount = useMemo(
    () =>
      contribs.reduce((sum, item) => {
        const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);
        return Number.isFinite(amount) ? sum + amount : sum;
      }, 0),
    [contribs]
  );

  async function onAssignPayout() {
    if (!selectedPayoutUserId) return;
    setAdminError(null);
    setAdminMessage(null);
    setIsAssigning(true);

    try {
      await api.put(`/tontine-cycles/${cycleNum}/assign-payout`, null, {
        params: { member_id: selectedPayoutUserId },
      });
      setAdminMessage("Payout member assigned.");
      await load();
    } catch (e) {
      setAdminError(getErrorMessage(e));
    } finally {
      setIsAssigning(false);
    }
  }

  async function onCloseCycle() {
    setAdminError(null);
    setAdminMessage(null);
    setIsClosing(true);

    try {
      await api.put(`/tontine-cycles/${cycleNum}/close`);
      setAdminMessage("Cycle closed successfully.");
      await load();
    } catch (e) {
      setAdminError(getErrorMessage(e));
    } finally {
      setIsClosing(false);
    }
  }

  async function onSetContributionApproval(contributionId: number, confirm: boolean) {
    setApprovalError(null);
    setApprovalMessage(null);
    setApprovingContributionId(contributionId);

    try {
      await api.put(`/contributions/${contributionId}/confirm`, { confirm });
      setApprovalMessage(confirm ? "Contribution confirmed." : "Contribution rejected.");
      await load();
    } catch (e) {
      setApprovalError(getErrorMessage(e));
    } finally {
      setApprovingContributionId(null);
    }
  }

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen
        options={{ title: cycle ? t("Cycle {{number}}", { number: cycle.cycle_number }) : t("Cycle") }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <ThemedText style={styles.error}>{error}</ThemedText>
      ) : cycle && tontine ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>Cycle workspace</ThemedText>
            <ThemedText style={styles.heroTitle}>
              {tontine.name} cycle {cycle.cycle_number}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Keep contribution approvals, payout assignment, and cycle readiness in one place.
            </ThemedText>

            <View style={styles.heroBadges}>
              <View
                style={[
                  styles.heroBadge,
                  cycle.is_closed ? styles.heroBadgeClosed : styles.heroBadgeOpen,
                ]}
              >
                <ThemedText
                  style={[
                    styles.heroBadgeText,
                    cycle.is_closed ? styles.heroBadgeTextClosed : styles.heroBadgeTextOpen,
                  ]}
                >
                  {cycle.is_closed ? "Closed" : "Open"}
                </ThemedText>
              </View>
              {isCurrentCycle ? (
                <View style={styles.heroBadgeCurrent}>
                  <ThemedText style={styles.heroBadgeCurrentText}>Current cycle</ThemedText>
                </View>
              ) : null}
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>{tontine.frequency}</ThemedText>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {formatAmount(tontine.contribution_amount)}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Expected per member</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {confirmedMemberCount}/{activeMembers.length}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Confirmed members</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{formatAmount(collectedAmount)}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Submitted volume</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <ThemedText type="subtitle">Cycle pulse</ThemedText>
            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{formatShortDate(cycle.start_date)}</ThemedText>
                <ThemedText style={styles.metricLabel}>Start date</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{formatShortDate(cycle.end_date)}</ThemedText>
                <ThemedText style={styles.metricLabel}>End date</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>
                  {cycle.payout_member_name ? cycle.payout_member_name : "Unassigned"}
                </ThemedText>
                <ThemedText style={styles.metricLabel}>Payout member</ThemedText>
              </View>
            </View>

            {canContribute ? (
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]/contribute",
                  params: { tontineId: String(tontineNum), cycleId: String(cycleNum) },
                }}
                asChild
              >
                <Pressable style={styles.primaryAction}>
                  <ThemedText style={styles.primaryActionText}>Add contribution</ThemedText>
                </Pressable>
              </Link>
            ) : (
              <View style={styles.infoBanner}>
                <ThemedText style={styles.infoBannerText}>
                  {isCurrentCycle
                    ? "This cycle is already closed for new contributions."
                    : "Contributions only stay open on the current cycle."}
                </ThemedText>
              </View>
            )}
          </View>

          {canManage ? (
            <View style={styles.card}>
              <ThemedText type="subtitle">Manage cycle</ThemedText>
              <ThemedText style={styles.supportText}>
                Choose the payout member, then close the cycle once every active member is confirmed.
              </ThemedText>

              {adminMessage ? <ThemedText style={styles.ok}>{adminMessage}</ThemedText> : null}
              {adminError ? <ThemedText style={styles.errorInline}>{adminError}</ThemedText> : null}

              <View style={styles.metricGrid}>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>
                    {allConfirmed ? "Ready" : "Waiting"}
                  </ThemedText>
                  <ThemedText style={styles.metricLabel}>Close readiness</ThemedText>
                </View>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>{isOwner ? "Owner" : "Admin"}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Your access</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.sectionLabel}>Assign payout member</ThemedText>
              <View style={styles.pillsRow}>
                {activeMembers.map((member) => (
                  <Pressable
                    key={member.id}
                    style={[
                      styles.pill,
                      selectedPayoutUserId === member.id ? styles.pillActive : null,
                    ]}
                    onPress={() => setSelectedPayoutUserId(member.id)}
                  >
                    <ThemedText
                      style={[
                        styles.pillText,
                        selectedPayoutUserId === member.id ? styles.pillTextActive : null,
                      ]}
                      numberOfLines={1}
                    >
                      {member.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.secondaryButton}
                  disabled={isAssigning || !selectedPayoutUserId || cycle.is_closed}
                  onPress={() => void onAssignPayout()}
                >
                  <ThemedText style={styles.secondaryButtonText}>
                    {isAssigning ? "Assigning..." : "Assign payout"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={styles.dangerButton}
                  disabled={isClosing || cycle.is_closed || !canCloseCycle}
                  onPress={() => void onCloseCycle()}
                >
                  <ThemedText style={styles.dangerButtonText}>
                    {isClosing ? "Closing..." : "Close cycle"}
                  </ThemedText>
                </Pressable>
              </View>

              {!isOwner ? (
                <ThemedText style={styles.supportText}>Only the owner can close the cycle.</ThemedText>
              ) : !isCurrentCycle ? (
                <ThemedText style={styles.supportText}>Only the current cycle can be closed.</ThemedText>
              ) : !allConfirmed ? (
                <ThemedText style={styles.supportText}>
                  Confirm all active members before closing ({confirmedMemberCount}/{activeMembers.length} done).
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Contributions</ThemedText>
              <ThemedText style={styles.supportText}>{contribs.length} entries</ThemedText>
            </View>

            {approvalMessage ? <ThemedText style={styles.ok}>{approvalMessage}</ThemedText> : null}
            {approvalError ? <ThemedText style={styles.errorInline}>{approvalError}</ThemedText> : null}

            {contribs.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>No contributions yet</ThemedText>
                <ThemedText style={styles.supportText}>
                  As members submit payments, they will appear here with review status and proof details.
                </ThemedText>
              </View>
            ) : (
              contribs.map((item) => {
                const tone = getContributionTone(item);

                return (
                  <View key={item.id} style={styles.contributionCard}>
                    <View style={styles.contributionHeader}>
                      <View style={styles.contributionHeading}>
                        <ThemedText style={styles.contributionTitle}>
                          {item.member_name ?? "Member"}
                        </ThemedText>
                        <ThemedText style={styles.supportText}>
                          Paid {formatShortDate(item.paid_at)}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: tone.bg, borderColor: tone.border },
                        ]}
                      >
                        <ThemedText style={[styles.statusBadgeText, { color: tone.text }]}>
                          {tone.label}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaTile}>
                        <ThemedText style={styles.metaValue}>{formatAmount(item.amount)}</ThemedText>
                        <ThemedText style={styles.metaLabel}>Amount</ThemedText>
                      </View>
                      <View style={styles.metaTile}>
                        <ThemedText style={styles.metaValue}>
                          {item.ledger_entry_created ? "Created" : "Pending"}
                        </ThemedText>
                        <ThemedText style={styles.metaLabel}>Ledger entry</ThemedText>
                      </View>
                    </View>

                    <ThemedText style={styles.supportText}>
                      Reference: {item.transaction_reference}
                    </ThemedText>
                    {item.proof_screenshot_url ? (
                      <ThemedText style={styles.supportText} numberOfLines={2}>
                        Proof: {item.proof_screenshot_url}
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.supportText}>Proof: none attached</ThemedText>
                    )}

                    {canManage ? (
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={styles.inlinePrimaryButton}
                          disabled={approvingContributionId === item.id}
                          onPress={() => void onSetContributionApproval(item.id, true)}
                        >
                          <ThemedText style={styles.inlinePrimaryButtonText}>
                            {approvingContributionId === item.id ? "Working..." : "Confirm"}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          style={styles.inlineDangerButton}
                          disabled={approvingContributionId === item.id}
                          onPress={() => void onSetContributionApproval(item.id, false)}
                        >
                          <ThemedText style={styles.inlineDangerButtonText}>
                            {approvingContributionId === item.id ? "Working..." : "Reject"}
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      ) : null}
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
    textTransform: "capitalize",
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
  heroBadgeOpen: {
    backgroundColor: "rgba(236, 253, 243, 0.14)",
    borderColor: "rgba(171, 239, 198, 0.45)",
  },
  heroBadgeClosed: {
    backgroundColor: "rgba(255, 247, 237, 0.14)",
    borderColor: "rgba(254, 215, 170, 0.45)",
  },
  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroBadgeTextOpen: { color: "#D9FBE8" },
  heroBadgeTextClosed: { color: "#FFE7CC" },
  heroBadgeCurrent: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(138, 55, 201, 0.36)",
    backgroundColor: "rgba(138, 55, 201, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeCurrentText: {
    color: "#F0D9FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
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
  infoBanner: {
    borderRadius: 20,
    backgroundColor: BrandColors.warningBg,
    borderWidth: 1,
    borderColor: BrandColors.warningBorder,
    padding: 14,
  },
  infoBannerText: {
    color: BrandColors.warningText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  supportText: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    color: BrandColors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: BrandColors.surfaceStrong,
    maxWidth: 160,
  },
  pillActive: {
    borderColor: BrandColors.blueDeep,
    backgroundColor: BrandColors.blueDeep,
  },
  pillText: {
    color: BrandColors.inkSoft,
    fontWeight: "700",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: BrandColors.surfaceStrong,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "800",
  },
  dangerButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    backgroundColor: BrandColors.dangerText,
    paddingVertical: 13,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
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
  contributionCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  contributionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  contributionHeading: {
    flex: 1,
    gap: 2,
  },
  contributionTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaTile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 12,
    gap: 2,
  },
  metaValue: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  metaLabel: {
    color: BrandColors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  inlinePrimaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 11,
    alignItems: "center",
    ...BrandShadow,
  },
  inlinePrimaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  inlineDangerButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: BrandColors.dangerText,
    paddingVertical: 11,
    alignItems: "center",
  },
  inlineDangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  ok: {
    color: BrandColors.successText,
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: BrandColors.dangerText,
    fontWeight: "700",
    fontSize: 14,
    padding: 20,
  },
  errorInline: {
    color: BrandColors.dangerText,
    fontWeight: "700",
    fontSize: 14,
  },
});
