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
  is_closed: boolean;
  closed_at?: string | null;
  start_date?: string;
  end_date?: string;
  payout_member_id?: number | null;
  payout_member_name?: string | null;
};

type CycleContributionStatus = {
  cycle_id: number;
  tontine_id: number;
  expected_members: number;
  paid_count: number;
  on_time_count?: number;
  late_count?: number;
  missing_count: number;
  total_received: string;
  expected_total: string;
  is_fully_funded: boolean;
  member_statuses?: {
    membership_id: number;
    user_id: number;
    name: string;
    phone?: string;
    status: "on_time" | "late" | "missing";
    paid_at?: string | null;
    amount?: string | null;
  }[];
};

type CycleContribution = {
  id: number;
  membership_id: number;
  user_id: number;
  user_name: string;
  user_phone: string;
  amount: string;
  transaction_reference?: string;
  proof_screenshot_url?: string | null;
  beneficiary_decision?: string;
  is_confirmed: boolean;
  ledger_entry_created?: boolean;
  paid_at: string;
};

type CycleContributionsResponse = {
  cycle_id: number;
  count: number;
  contributions: CycleContribution[];
};

type Tontine = {
  id: number;
  owner_id: number;
  contribution_amount: string;
  current_cycle: number;
  name: string;
  frequency?: string | null;
};

type MemberRow = {
  membership_id: number;
  id: number;
  name: string;
  phone: string;
  membership_role: string;
  membership_status: "active" | "pending";
};

type DebtRow = {
  id: number;
  cycle_id: number;
  debtor_name: string;
  coverer_name: string;
  amount: string;
  is_repaid: boolean;
};

type DebtListResponse = {
  tontine_id: number;
  count: number;
  debts: DebtRow[];
};

function formatCurrency(value?: string | number | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat(getCurrentLocale(), {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(getCurrentLocale() === "fr" ? "fr-FR" : "en-US");
}

function getContributionTone(item: CycleContribution) {
  if (item.is_confirmed) {
    return { bg: "#ECFDF3", border: "#ABEFC6", text: "#067647", label: "confirmed" };
  }
  if ((item.beneficiary_decision || "").toLowerCase() === "rejected") {
    return { bg: "#FEF3F2", border: "#FECDCA", text: "#B42318", label: "rejected" };
  }
  return { bg: "#FFFAEB", border: "#FEDF89", text: "#B54708", label: "pending" };
}

function getMemberStatusTone(status: "on_time" | "late" | "missing") {
  if (status === "on_time") {
    return { bg: BrandColors.successBg, border: BrandColors.successBorder, text: BrandColors.successText };
  }
  if (status === "late") {
    return { bg: BrandColors.warningBg, border: BrandColors.warningBorder, text: BrandColors.warningText };
  }
  return { bg: BrandColors.dangerBg, border: BrandColors.dangerBorder, text: BrandColors.dangerText };
}

export default function CycleDetailScreen() {
  const { tontineId, cycleId } = useLocalSearchParams<{ tontineId: string; cycleId: string }>();
  const tontineNum = useMemo(() => Number(tontineId), [tontineId]);
  const cycleNum = useMemo(() => Number(cycleId), [cycleId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [status, setStatus] = useState<CycleContributionStatus | null>(null);
  const [contributions, setContributions] = useState<CycleContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [approvingContributionId, setApprovingContributionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cycleRes, statusRes, contributionsRes] = await Promise.all([
        api.get<Cycle>(`/tontine-cycles/${cycleNum}`),
        api.get<CycleContributionStatus>(`/contributions/cycle/${cycleNum}/status`),
        api.get<CycleContributionsResponse>(`/contributions/cycle/${cycleNum}`),
      ]);
      const [tontineRes, membersRes, debtRes] = await Promise.all([
        api.get<Tontine>(`/tontines/${cycleRes.data.tontine_id}`),
        api.get<MemberRow[]>(`/tontine-memberships/tontine/${cycleRes.data.tontine_id}/members`),
        api.get<DebtListResponse>(`/debts/tontine/${cycleRes.data.tontine_id}`),
      ]);

      setCycle(cycleRes.data);
      setStatus(statusRes.data);
      setContributions(contributionsRes.data.contributions);
      setTontine(tontineRes.data);
      setMembers(membersRes.data);
      setDebts(debtRes.data.debts.filter((item) => item.cycle_id === cycleRes.data.id));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cycleNum]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(cycleNum) || !Number.isFinite(tontineNum)) {
        setIsLoading(false);
        setError(t("Invalid route params."));
        return;
      }
      void load();
    }, [cycleNum, load, t, tontineNum])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
  }

  async function onCloseCycle() {
    setError(null);
    setMessage(null);
    setIsClosing(true);
    try {
      await api.put(`/tontine-cycles/${cycleNum}/close`);
      setMessage(t("Cycle closed successfully."));
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsClosing(false);
    }
  }

  async function onSetContributionApproval(contributionId: number, confirm: boolean) {
    setError(null);
    setMessage(null);
    setApprovingContributionId(contributionId);
    try {
      await api.post(`/contributions/${contributionId}/beneficiary-confirmation`, {
        decision: confirm ? "confirm" : "reject",
      });
      setMessage(confirm ? t("Contribution confirmed.") : t("Contribution rejected."));
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setApprovingContributionId(null);
    }
  }

  const isOwner = !!user && !!tontine && user.id === tontine.owner_id;
  const isGlobalAdmin = !!user?.is_global_admin;
  const myMember = user ? members.find((member) => member.id === user.id) : null;
  const isActiveMember = !!myMember && myMember.membership_status === "active";
  const isAdmin = !!myMember && myMember.membership_role === "admin" && myMember.membership_status === "active";
  const canManage = isOwner || isAdmin || isGlobalAdmin;
  const isCurrentCycle = !!cycle && !!tontine && cycle.cycle_number === tontine.current_cycle;
  const isBeneficiary = !!user && !!cycle && cycle.payout_member_id === user.id;
  const canContribute = !!cycle && !cycle.is_closed && isCurrentCycle && isActiveMember && !isBeneficiary;
  const openDebts = debts.filter((item) => !item.is_repaid);
  const canClose =
    (isOwner || isGlobalAdmin) &&
    !!cycle &&
    !cycle.is_closed &&
    !!status?.is_fully_funded &&
    isCurrentCycle;
  const pendingBeneficiaryReviews = contributions.filter(
    (item) => !item.is_confirmed && (item.beneficiary_decision || "pending").toLowerCase() === "pending"
  );

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: cycle ? t("Cycle {{number}}", { number: cycle.cycle_number }) : t("Cycle") }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !cycle ? (
        <ThemedText style={styles.error}>{error}</ThemedText>
      ) : cycle && tontine && status ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>{t("Cycle {{number}}", { number: cycle.cycle_number })}</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              {t("Monitor funding progress, member activity, review actions, and debt context from one consolidated cycle workspace.")}
            </ThemedText>
          </View>

          {message ? <ThemedText style={styles.ok}>{message}</ThemedText> : null}
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />
            <ThemedText style={styles.eyebrow}>{t("Cycle workspace")}</ThemedText>
            <ThemedText style={styles.heroTitle}>
              {t("{{name}} cycle {{number}}", { name: tontine.name, number: cycle.cycle_number })}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {t("Funding progress, payout readiness, and member payment status for this cycle.")}
            </ThemedText>

            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, cycle.is_closed ? styles.heroBadgeClosed : styles.heroBadgeOpen]}>
                <ThemedText style={[styles.heroBadgeText, cycle.is_closed ? styles.heroBadgeTextClosed : styles.heroBadgeTextOpen]}>
                  {cycle.is_closed ? t("Closed") : t("Open")}
                </ThemedText>
              </View>
              {isCurrentCycle ? (
                <View style={styles.heroBadgeCurrent}>
                  <ThemedText style={styles.heroBadgeCurrentText}>{t("Current cycle")}</ThemedText>
                </View>
              ) : null}
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>{tontine.frequency ?? t("schedule")}</ThemedText>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{formatCurrency(status.total_received)}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Received")}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{status.paid_count}/{status.expected_members}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Paid members")}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{openDebts.length}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Open debts")}</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Funding status")}</ThemedText>
              {canContribute ? (
                <Link
                  href={{
                    pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]/contribute",
                    params: { tontineId: String(tontineNum), cycleId: String(cycleNum) },
                  }}
                  asChild
                >
                  <Pressable style={styles.linkButton}>
                    <ThemedText style={styles.linkText}>{t("Contribute")}</ThemedText>
                  </Pressable>
                </Link>
              ) : null}
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{formatCurrency(status.expected_total)}</ThemedText>
                <ThemedText style={styles.metricLabel}>{t("Expected total")}</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{status.missing_count}</ThemedText>
                <ThemedText style={styles.metricLabel}>{t("Missing")}</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{cycle.payout_member_name || t("Unassigned")}</ThemedText>
                <ThemedText style={styles.metricLabel}>{t("Payout member")}</ThemedText>
              </View>
            </View>

            <View style={styles.rowCard}>
              <View style={styles.rowText}>
                <ThemedText style={styles.rowTitle}>{t("Cycle window")}</ThemedText>
                <ThemedText style={styles.supportText}>
                  {t("{{start}} to {{end}}", {
                    start: formatDate(cycle.start_date),
                    end: formatDate(cycle.end_date),
                  })}
                </ThemedText>
                {isBeneficiary ? (
                  <ThemedText style={styles.supportText}>{t("Beneficiary for this cycle does not contribute.")}</ThemedText>
                ) : null}
              </View>
              <View style={[styles.statusPill, status.is_fully_funded ? styles.statusPillClear : styles.statusPillOpen]}>
                <ThemedText style={[styles.statusPillText, status.is_fully_funded ? styles.statusPillTextClear : styles.statusPillTextOpen]}>
                  {status.is_fully_funded ? t("Ready") : t("Waiting")}
                </ThemedText>
              </View>
            </View>
          </View>

          {canManage ? (
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>{t("Manage cycle")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t("Rotation is automatic. Close the cycle once every non-beneficiary active member is funded.")}
              </ThemedText>
              <View style={styles.actionsRow}>
                <Pressable style={styles.primaryButton} disabled={isClosing || !canClose} onPress={() => void onCloseCycle()}>
                  <ThemedText style={styles.primaryButtonText}>{isClosing ? t("Closing...") : t("Close cycle")}</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>{t("Member payment status")}</ThemedText>
            {status.member_statuses?.length ? (
              status.member_statuses.map((member) => {
                const tone = getMemberStatusTone(member.status);
                return (
                  <View key={member.membership_id} style={styles.rowCard}>
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowTitle}>{member.name}</ThemedText>
                      <ThemedText style={styles.supportText}>
                        {member.status === "missing"
                          ? t("No confirmed payment yet")
                          : `${member.status === "on_time" ? t("On time") : t("Late")} · ${formatCurrency(member.amount)}`}
                      </ThemedText>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <ThemedText style={[styles.statusPillText, { color: tone.text }]}>
                        {member.status === "on_time"
                          ? t("On time")
                          : member.status === "late"
                            ? t("Late")
                            : t("Missing")}
                      </ThemedText>
                    </View>
                  </View>
                );
              })
            ) : (
              <ThemedText style={styles.supportText}>{t("No payment roster available yet.")}</ThemedText>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Submitted contributions")}</ThemedText>
              <ThemedText style={styles.supportText}>{t("{{count}} entries", { count: contributions.length })}</ThemedText>
            </View>
            {contributions.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>{t("No contributions yet")}</ThemedText>
                <ThemedText style={styles.supportText}>
                  {t("As members submit payments, they will appear here with review status.")}
                </ThemedText>
              </View>
            ) : (
              contributions.map((item) => {
                const tone = getContributionTone(item);
                return (
                  <View key={item.id} style={styles.contributionCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.rowText}>
                        <ThemedText style={styles.rowTitle}>{item.user_name}</ThemedText>
                        <ThemedText style={styles.supportText}>{t("Paid {{date}}", { date: formatDate(item.paid_at) })}</ThemedText>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <ThemedText style={[styles.statusPillText, { color: tone.text }]}>{t(tone.label)}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.metricGrid}>
                      <View style={styles.metricTile}>
                        <ThemedText style={styles.metricValue}>{formatCurrency(item.amount)}</ThemedText>
                        <ThemedText style={styles.metricLabel}>{t("Amount")}</ThemedText>
                      </View>
                      <View style={styles.metricTile}>
                        <ThemedText style={styles.metricValue}>{item.ledger_entry_created ? t("Created") : t("Pending")}</ThemedText>
                        <ThemedText style={styles.metricLabel}>{t("Ledger")}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.supportText}>
                      {t("Reference: {{reference}}", {
                        reference: item.transaction_reference || t("No reference"),
                      })}
                    </ThemedText>
                    {item.proof_screenshot_url ? (
                      <ThemedText style={styles.supportText}>
                        {t("Proof: {{proof}}", { proof: item.proof_screenshot_url })}
                      </ThemedText>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {isBeneficiary ? (
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>{t("Beneficiary review")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t("Confirm submitted payments after checking the screenshot proof and transaction reference.")}
              </ThemedText>
              {pendingBeneficiaryReviews.length === 0 ? (
                <ThemedText style={styles.supportText}>{t("No pending reviews right now.")}</ThemedText>
              ) : (
                pendingBeneficiaryReviews.map((item) => (
                  <View key={`review-${item.id}`} style={styles.contributionCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.rowText}>
                        <ThemedText style={styles.rowTitle}>{item.user_name}</ThemedText>
                        <ThemedText style={styles.supportText}>
                          {formatCurrency(item.amount)} · {item.transaction_reference || t("No reference")}
                        </ThemedText>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: "#FFFAEB", borderColor: "#FEDF89" }]}>
                        <ThemedText style={[styles.statusPillText, { color: "#B54708" }]}>{t("pending")}</ThemedText>
                      </View>
                    </View>
                    {item.proof_screenshot_url ? (
                      <ThemedText style={styles.supportText}>{t("Proof: {{proof}}", { proof: item.proof_screenshot_url })}</ThemedText>
                    ) : (
                      <ThemedText style={styles.supportText}>{t("No proof screenshot provided.")}</ThemedText>
                    )}
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.secondaryButton}
                        disabled={approvingContributionId === item.id}
                        onPress={() => void onSetContributionApproval(item.id, true)}
                      >
                        <ThemedText style={styles.secondaryButtonText}>
                          {approvingContributionId === item.id ? t("Working...") : t("Confirm")}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.inlineDangerButton}
                        disabled={approvingContributionId === item.id}
                        onPress={() => void onSetContributionApproval(item.id, false)}
                      >
                        <ThemedText style={styles.inlineDangerButtonText}>
                          {approvingContributionId === item.id ? t("Working...") : t("Reject")}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t("Debt snapshot")}</ThemedText>
              <Link href={{ pathname: "/(tabs)/tontines/[tontineId]/debts", params: { tontineId: String(tontineNum) } }} asChild>
                <Pressable style={styles.linkButton}>
                  <ThemedText style={styles.linkText}>{t("Open debts")}</ThemedText>
                </Pressable>
              </Link>
            </View>
            {debts.length === 0 ? (
              <ThemedText style={styles.supportText}>{t("No debts linked to this cycle.")}</ThemedText>
            ) : (
              debts.map((item) => (
                <View key={item.id} style={styles.rowCard}>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>
                      {t("{{debtor}} owes {{coverer}}", {
                        debtor: item.debtor_name,
                        coverer: item.coverer_name,
                      })}
                    </ThemedText>
                    <ThemedText style={styles.supportText}>
                      {formatCurrency(item.amount)} · {item.is_repaid ? t("Repaid") : t("Open")}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 18, paddingBottom: 120, gap: 18 },
  pageHeader: { gap: 6 },
  pageTitle: { color: BrandColors.ink, fontSize: 28, lineHeight: 32, fontWeight: "800" },
  pageSubtitle: { color: BrandColors.muted, fontSize: 14, lineHeight: 20 },
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
  heroSubtitle: { color: "#E6EEFF", fontSize: 15, lineHeight: 22 },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  heroBadgeOpen: { backgroundColor: "rgba(236, 253, 243, 0.14)", borderColor: "rgba(171, 239, 198, 0.45)" },
  heroBadgeClosed: { backgroundColor: "rgba(255, 247, 237, 0.14)", borderColor: "rgba(254, 215, 170, 0.45)" },
  heroBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
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
  heroBadgeCurrentText: { color: "#F0D9FF", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  heroBadgeNeutral: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeNeutralText: { color: "#EAF1FF", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  heroStatValue: { color: "#FFFFFF", fontSize: 24, lineHeight: 28, fontWeight: "800" },
  heroStatLabel: { color: "#CFE0FF", fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 14,
    ...BrandShadow,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardTitle: { color: BrandColors.ink, fontSize: 22, lineHeight: 26, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  metricValue: { color: BrandColors.ink, fontSize: 20, lineHeight: 24, fontWeight: "800" },
  metricLabel: { color: BrandColors.muted, fontSize: 13, lineHeight: 18 },
  linkButton: { borderRadius: 999, backgroundColor: "rgba(46,207,227,0.1)", paddingHorizontal: 12, paddingVertical: 8 },
  linkText: { color: BrandColors.inkSoft, fontSize: 13, lineHeight: 16, fontWeight: "800" },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: BrandColors.ink, fontSize: 16, lineHeight: 20, fontWeight: "800" },
  supportText: { color: BrandColors.muted, fontSize: 14, lineHeight: 20 },
  sectionLabel: { color: BrandColors.ink, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: BrandColors.surfaceStrong,
    maxWidth: 160,
  },
  pillActive: { borderColor: BrandColors.blueDeep, backgroundColor: BrandColors.blueDeep },
  pillText: { color: BrandColors.inkSoft, fontWeight: "700" },
  pillTextActive: { color: "#FFFFFF" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800" },
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
  secondaryButtonText: { color: BrandColors.inkSoft, fontWeight: "800" },
  inlineDangerButton: {
    flex: 1,
    minWidth: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.dangerBorder,
    backgroundColor: BrandColors.dangerBg,
    paddingVertical: 13,
    alignItems: "center",
  },
  inlineDangerButtonText: { color: BrandColors.dangerText, fontWeight: "800" },
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  statusPillOpen: { backgroundColor: BrandColors.warningBg, borderColor: BrandColors.warningBorder },
  statusPillClear: { backgroundColor: BrandColors.successBg, borderColor: BrandColors.successBorder },
  statusPillText: { fontSize: 12, lineHeight: 16, fontWeight: "800", textTransform: "capitalize" },
  statusPillTextOpen: { color: BrandColors.warningText },
  statusPillTextClear: { color: BrandColors.successText },
  contributionCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 12,
  },
  emptyState: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 16,
    gap: 8,
  },
  emptyTitle: { color: BrandColors.ink, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  ok: { color: BrandColors.successText, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  error: { color: BrandColors.dangerText, fontSize: 14, lineHeight: 20, fontWeight: "700" },
});
