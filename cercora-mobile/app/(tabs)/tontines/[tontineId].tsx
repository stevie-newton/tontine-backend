import { useFocusEffect } from "@react-navigation/native";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
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

type Debt = {
  id: number;
  cycle_id: number;
  debtor_membership_id: number;
  debtor_user_id: number;
  debtor_name: string;
  coverer_membership_id: number;
  coverer_user_id: number;
  coverer_name: string;
  amount: string;
  is_repaid: boolean;
  notes?: string | null;
  created_at: string;
  repaid_at?: string | null;
};

type DebtListResponse = {
  tontine_id: number;
  count: number;
  debts: Debt[];
};

type MyReliabilityProfile = {
  reliability_score_percent: number;
  cycles_completed: number;
  late_payments: number;
  debts_repaid: number;
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
  const router = useRouter();
  const layout = useResponsiveLayout();
  const id = useMemo(() => Number(tontineId), [tontineId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [summary, setSummary] = useState<ContributionSummary | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [myReliability, setMyReliability] = useState<MyReliabilityProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const tontineReq = api.get<Tontine>(`/tontines/${id}`);
      const membersReq = api.get<Member[]>(`/tontine-memberships/tontine/${id}/members`);
      const cyclesReq = api.get<Cycle[]>(`/tontine-cycles/tontine/${id}`);
      const currentCycleReq = api
        .get<Cycle>(`/tontine-cycles/tontine/${id}/current`)
        .then((r) => r.data)
        .catch(() => null);
      const debtsReq = api
        .get<DebtListResponse>(`/debts/tontine/${id}`)
        .then((r) => r.data.debts)
        .catch(() => [] as Debt[]);
      const reliabilityReq = api
        .get<MyReliabilityProfile>("/users/me/reliability", { params: { tontine_id: id } })
        .then((r) => r.data)
        .catch(() => null);

      const [tontineRes, membersRes, cyclesRes, cycle, debtList, reliability] = await Promise.all([
        tontineReq,
        membersReq,
        cyclesReq,
        currentCycleReq,
        debtsReq,
        reliabilityReq,
      ]);

      setTontine(tontineRes.data);
      setMembers(membersRes.data);
      setCycles(cyclesRes.data);
      setCurrentCycle(cycle);
      setDebts(debtList);
      setMyReliability(reliability);

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
        setError(t("Invalid tontine id."));
        return;
      }
      void load();
    }, [id, load, t])
  );

  async function onGenerateCycles() {
    setIsGenerating(true);
    setError(null);
    try {
      await api.post(`/tontine-cycles/generate/${id}`);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsGenerating(false);
    }
  }

  async function onActivateTontine() {
    setIsActivating(true);
    setError(null);
    try {
      await api.post(`/tontines/${id}/activate`);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsActivating(false);
    }
  }

  async function deleteTontine() {
    setIsDeleting(true);
    setError(null);
    try {
      await api.delete(`/tontines/${id}`);
      router.replace("/(tabs)/tontines");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsDeleting(false);
    }
  }

  function confirmDeleteTontine() {
    Alert.alert(
      t("Delete tontine"),
      t(
        "Delete this tontine only if it has no contributions, payments, payouts, debts, or ledger activity. This action cannot be undone."
      ),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () => void deleteTontine(),
        },
      ]
    );
  }

  const activeMembers = members.filter((member) => member.membership_status === "active");
  const pendingMembers = members.filter((member) => member.membership_status !== "active");
  const myMembership = user ? members.find((member) => member.id === user.id) ?? null : null;
  const isOwner = !!user && !!tontine && tontine.owner_id === user.id;
  const isAdmin =
    !!myMembership &&
    myMembership.membership_role === "admin" &&
    myMembership.membership_status === "active";
  const canManage = isOwner || isAdmin;
  const tone = getStatusTone(tontine?.status ?? "draft");
  const openDebts = debts.filter((debt) => !debt.is_repaid);
  const recentCycles = cycles.slice(0, 3);
  const recentDebts = debts.slice(0, 3);

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
          <View
            style={[
              styles.page,
              layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
            ]}
          >
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>{tontine.name}</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              {t(
                "A mobile workspace built from the web tontine page: overview, reliability, members, cycles, and debts in one place."
              )}
            </ThemedText>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>{t("Tontine workspace")}</ThemedText>
            <ThemedText style={styles.heroTitle}>{tontine.name}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {t("Current cycle: {{current}}/{{total}}", {
                current: tontine.current_cycle,
                total: tontine.total_cycles,
              })}
            </ThemedText>

            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <ThemedText style={[styles.heroBadgeText, { color: tone.text }]}>
                  {t(
                    tontine.status.charAt(0).toUpperCase() +
                      tontine.status.slice(1).toLowerCase()
                  )}
                </ThemedText>
              </View>
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>
                  {t(
                    tontine.frequency.charAt(0).toUpperCase() +
                      tontine.frequency.slice(1).toLowerCase()
                  )}
                </ThemedText>
              </View>
              {canManage ? (
                <View style={styles.heroBadgeAdmin}>
                  <ThemedText style={styles.heroBadgeAdminText}>
                    {isOwner ? t("Owner") : t("Admin")}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {formatAmount(tontine.contribution_amount)}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Contribution")}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{activeMembers.length}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Active members")}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{openDebts.length}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Open debts")}</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.actionGrid}>
            {canManage && tontine.status === "draft" ? (
              <Pressable
                style={[
                  styles.primaryAction,
                  cycles.length === 0 ? styles.primaryActionDisabled : null,
                ]}
                disabled={isActivating || cycles.length === 0}
                onPress={() => void onActivateTontine()}
              >
                {isActivating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.primaryActionText}>
                    {cycles.length === 0 ? t("Generate cycles first") : t("Activate tontine")}
                  </ThemedText>
                )}
              </Pressable>
            ) : null}

            {canManage && cycles.length === 0 ? (
              <Pressable style={styles.primaryAction} onPress={() => void onGenerateCycles()}>
                {isGenerating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.primaryActionText}>{t("Generate cycles")}</ThemedText>
                )}
              </Pressable>
            ) : null}

            {canManage ? (
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/invite",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.secondaryAction}>
                  <ThemedText style={styles.secondaryActionText}>{t("Invite member")}</ThemedText>
                </Pressable>
              </Link>
            ) : null}

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/members",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable style={styles.secondaryAction}>
                <ThemedText style={styles.secondaryActionText}>{t("Members")}</ThemedText>
              </Pressable>
            </Link>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/cycles",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable style={styles.secondaryAction}>
                <ThemedText style={styles.secondaryActionText}>{t("Cycles")}</ThemedText>
              </Pressable>
            </Link>
          </View>

          {isOwner ? (
            <View style={styles.dangerCard}>
              <ThemedText style={styles.dangerTitle}>{t("Delete tontine")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t("You can remove this tontine only when no financial activity has been recorded yet.")}
              </ThemedText>
              <Pressable
                style={[
                  styles.dangerButton,
                  isDeleting ? styles.dangerButtonDisabled : null,
                ]}
                disabled={isDeleting}
                onPress={confirmDeleteTontine}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.dangerButtonText}>{t("Delete tontine")}</ThemedText>
                )}
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.sectionGrid, layout.isTablet ? styles.sectionGridTablet : null]}>
          {myReliability ? (
            <View style={[styles.cardShell, layout.isTablet ? styles.cardShellTablet : null]}>
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>{t("Reliability")}</ThemedText>
              <View style={styles.metricGrid}>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>
                    {myReliability.reliability_score_percent}%
                  </ThemedText>
                  <ThemedText style={styles.metricLabel}>{t("Score")}</ThemedText>
                </View>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>
                    {myReliability.cycles_completed}
                  </ThemedText>
                  <ThemedText style={styles.metricLabel}>{t("Cycles completed")}</ThemedText>
                </View>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>{myReliability.late_payments}</ThemedText>
                  <ThemedText style={styles.metricLabel}>{t("Late payments")}</ThemedText>
                </View>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>{myReliability.debts_repaid}</ThemedText>
                  <ThemedText style={styles.metricLabel}>{t("Debts repaid")}</ThemedText>
                </View>
              </View>
            </View>
            </View>
          ) : null}

          <View style={[styles.cardShell, layout.isTablet ? styles.cardShellTablet : null]}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Current cycle")}</ThemedText>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/cycles",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>{t("View all")}</ThemedText>
                </Pressable>
              </Link>
            </View>

            {currentCycle ? (
              <>
                <View style={styles.currentCycleBanner}>
                  <ThemedText style={styles.currentCycleLabel}>
                    {t("Cycle {{number}}", { number: currentCycle.cycle_number })}
                  </ThemedText>
                  <ThemedText style={styles.currentCycleMeta}>
                    {t("{{status}} - {{start}} to {{end}}", {
                      status: currentCycle.is_closed ? t("Closed") : t("Open"),
                      start: formatShortDate(currentCycle.start_date),
                      end: formatShortDate(currentCycle.end_date),
                    })}
                  </ThemedText>
                  {currentCycle.payout_member_name ? (
                    <ThemedText style={styles.currentCycleMeta}>
                      {t("Payout member: {{name}}", {
                        name: currentCycle.payout_member_name,
                      })}
                    </ThemedText>
                  ) : null}
                </View>

                {summary ? (
                  <View style={styles.metricGrid}>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>
                        {summary.total_contributions}/{summary.total_members}
                      </ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Submitted")}</ThemedText>
                    </View>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>{summary.confirmed_contributions}</ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Confirmed")}</ThemedText>
                    </View>
                    <View style={styles.metricTile}>
                      <ThemedText style={styles.metricValue}>{formatAmount(summary.total_amount)}</ThemedText>
                      <ThemedText style={styles.metricLabel}>{t("Collected")}</ThemedText>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>{t("No cycles generated yet")}</ThemedText>
                <ThemedText style={styles.supportText}>
                  {canManage
                    ? t("Generate cycles to activate this tontine flow.")
                    : t("Ask the owner to generate cycles to begin tracking payments.")}
                </ThemedText>
              </View>
            )}
          </View>
          </View>

          <View style={[styles.cardShell, layout.isTablet ? styles.cardShellTablet : null]}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Members")}</ThemedText>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/members",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>{t("Open")}</ThemedText>
                </Pressable>
              </Link>
            </View>

            <View style={styles.memberSummaryRow}>
              <View style={styles.memberSummaryTile}>
                <ThemedText style={styles.memberSummaryValue}>{activeMembers.length}</ThemedText>
                <ThemedText style={styles.memberSummaryLabel}>{t("Active")}</ThemedText>
              </View>
              <View style={styles.memberSummaryTile}>
                <ThemedText style={styles.memberSummaryValue}>{pendingMembers.length}</ThemedText>
                <ThemedText style={styles.memberSummaryLabel}>{t("Pending")}</ThemedText>
              </View>
              <View style={styles.memberSummaryTile}>
                <ThemedText style={styles.memberSummaryValue}>{openDebts.length}</ThemedText>
                <ThemedText style={styles.memberSummaryLabel}>{t("Debt flags")}</ThemedText>
              </View>
            </View>

            {members.slice(0, 5).map((member) => {
              const hasOpenDebt = openDebts.some((debt) => debt.debtor_user_id === member.id);

              return (
                <View key={member.membership_id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <ThemedText style={styles.memberName}>{member.name}</ThemedText>
                    <ThemedText style={styles.supportText}>
                      {member.membership_role} · {member.membership_status}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.memberDebtBadge,
                      hasOpenDebt ? styles.memberDebtBadgeOpen : styles.memberDebtBadgeClear,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.memberDebtBadgeText,
                        hasOpenDebt ? styles.memberDebtBadgeTextOpen : styles.memberDebtBadgeTextClear,
                      ]}
                    >
                      {hasOpenDebt ? t("Open debt") : t("Clear")}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
          </View>

          <View style={[styles.cardShell, layout.isTablet ? styles.cardShellTablet : null]}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Cycles")}</ThemedText>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/cycles",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>{t("Open")}</ThemedText>
                </Pressable>
              </Link>
            </View>

            {recentCycles.length === 0 ? (
              <ThemedText style={styles.supportText}>{t("No cycles created yet.")}</ThemedText>
            ) : (
              recentCycles.map((cycle) => (
                <View key={cycle.id} style={styles.rowCard}>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>
                      {t("Cycle #{{number}}", { number: cycle.cycle_number })}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      {cycle.is_closed ? "Closed" : "Open"} · {formatShortDate(cycle.start_date)}
                    </ThemedText>
                  </View>
                  <Link
                    href={{
                      pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]",
                      params: {
                        tontineId: String(tontine.id),
                        cycleId: String(cycle.id),
                      },
                    }}
                    asChild
                  >
                    <Pressable style={styles.inlineOpenButton}>
                      <ThemedText style={styles.inlineOpenButtonText}>{t("Open")}</ThemedText>
                    </Pressable>
                  </Link>
                </View>
              ))
            )}
          </View>
          </View>

          <View style={[styles.cardShell, layout.isTablet ? styles.cardShellTablet : null]}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Debts")}</ThemedText>
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]/debts",
                  params: { tontineId: String(tontine.id) },
                }}
                asChild
              >
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>{t("Open")}</ThemedText>
                </Pressable>
              </Link>
            </View>

            {recentDebts.length === 0 ? (
              <ThemedText style={styles.supportText}>
                {t("No debts recorded for this tontine.")}
              </ThemedText>
            ) : (
              recentDebts.map((debt) => (
                <View key={debt.id} style={styles.rowCard}>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>
                      {t("Cycle {{cycle}}: {{name}}", {
                        cycle: debt.cycle_id,
                        name: debt.debtor_name,
                      })}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      Covered by {debt.coverer_name} · {formatAmount(debt.amount)}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      debt.is_repaid ? styles.statusPillClear : styles.statusPillOpen,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.statusPillText,
                        debt.is_repaid ? styles.statusPillTextClear : styles.statusPillTextOpen,
                      ]}
                    >
                      {debt.is_repaid ? t("Repaid") : t("Open")}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
          </View>
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
    paddingBottom: 128,
    alignItems: "center",
  },
  page: {
    width: "100%",
    gap: 22,
  },
  pageHeader: {
    gap: 6,
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
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: BrandColors.blueNight,
    padding: 24,
    gap: 16,
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
    fontSize: 33,
    lineHeight: 37,
    fontWeight: "800",
    letterSpacing: -0.8,
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
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 15,
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
  sectionGrid: {
    width: "100%",
    gap: 16,
  },
  sectionGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  cardShell: {
    width: "100%",
  },
  cardShellTablet: {
    width: "49.2%",
  },
  primaryAction: {
    minWidth: 145,
    borderRadius: 20,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    ...BrandShadow,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  primaryActionDisabled: {
    opacity: 0.6,
  },
  secondaryAction: {
    minWidth: 120,
    borderRadius: 20,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  secondaryActionText: {
    color: BrandColors.inkSoft,
    fontWeight: "700",
    fontSize: 14,
  },
  dangerCard: {
    borderRadius: 28,
    backgroundColor: "#FFF1F3",
    borderWidth: 1,
    borderColor: "#FBCFE8",
    padding: 20,
    gap: 12,
    ...BrandShadow,
  },
  dangerTitle: {
    color: "#9F1239",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  dangerButton: {
    borderRadius: 18,
    backgroundColor: "#C01048",
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonDisabled: {
    opacity: 0.7,
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  card: {
    borderRadius: 30,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 16,
    ...BrandShadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    color: BrandColors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
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
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    minWidth: 110,
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
  currentCycleBanner: {
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 16,
    gap: 6,
  },
  currentCycleLabel: {
    color: "#1D4ED8",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  currentCycleMeta: {
    color: "#1E3A8A",
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 22,
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
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
    gap: 4,
  },
  memberSummaryValue: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  memberSummaryLabel: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
  },
  memberInfo: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  memberDebtBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  memberDebtBadgeOpen: {
    backgroundColor: BrandColors.warningBg,
    borderColor: BrandColors.warningBorder,
  },
  memberDebtBadgeClear: {
    backgroundColor: BrandColors.successBg,
    borderColor: BrandColors.successBorder,
  },
  memberDebtBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  memberDebtBadgeTextOpen: {
    color: BrandColors.warningText,
  },
  memberDebtBadgeTextClear: {
    color: BrandColors.successText,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 15,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  inlineOpenButton: {
    borderRadius: 12,
    backgroundColor: "rgba(16,36,72,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineOpenButtonText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillOpen: {
    backgroundColor: BrandColors.warningBg,
    borderColor: BrandColors.warningBorder,
  },
  statusPillClear: {
    backgroundColor: BrandColors.successBg,
    borderColor: BrandColors.successBorder,
  },
  statusPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  statusPillTextOpen: {
    color: BrandColors.warningText,
  },
  statusPillTextClear: {
    color: BrandColors.successText,
  },
  error: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    padding: 18,
  },
});
