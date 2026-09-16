import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
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

type TransactionSummary = {
  transaction_count: number;
  total_contributions: string | number;
  total_payouts: string | number;
  total_fees: string | number;
  balance: string | number;
  last_transaction_date: string | null;
};

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
  const colors = useSurfaceColors();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [summary, setSummary] = useState<ContributionSummary | null>(null);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
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
      const transactionSummaryReq = api
        .get<TransactionSummary>(`/transactions/tontine/${id}/summary`)
        .then((r) => r.data)
        .catch(() => null);

      const [
        tontineRes,
        membersRes,
        cyclesRes,
        cycle,
        debtList,
        ledgerSummary,
      ] = await Promise.all([
        tontineReq,
        membersReq,
        cyclesReq,
        currentCycleReq,
        debtsReq,
        transactionSummaryReq,
      ]);

      setTontine(tontineRes.data);
      setMembers(membersRes.data);
      setCycles(cyclesRes.data);
      setCurrentCycle(cycle);
      setDebts(debtList);
      setTransactionSummary(ledgerSummary);

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
    if (hasFinancialActivity && !isGlobalAdmin) {
      Alert.alert(
        t("Financial records preserved"),
        t(
          "This tontine has financial activity and cannot be deleted. Its contributions, payouts, debts, and ledger history stay available for records."
        ),
        [{ text: t("OK") }]
      );
      return;
    }

    Alert.alert(
      t("Delete tontine"),
      isGlobalAdmin
        ? t(
            "As a global admin, you can delete this tontine even if financial activity already exists. This action cannot be undone."
          )
        : t(
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
  const myMembership = user ? members.find((member) => member.id === user.id) ?? null : null;
  const isOwner = !!user && !!tontine && tontine.owner_id === user.id;
  const isGlobalAdmin = !!user?.is_global_admin;
  const isAdmin =
    !!myMembership &&
    myMembership.membership_role === "admin" &&
    myMembership.membership_status === "active";
  const canManage = isOwner || isAdmin;
  const hasFinancialActivity =
    !!summary?.total_contributions ||
    Number(summary?.total_amount ?? 0) > 0 ||
    (transactionSummary?.transaction_count ?? 0) > 0 ||
    debts.length > 0 ||
    cycles.some((cycle) => cycle.is_closed);
  const canDeleteTontine = isGlobalAdmin || (isOwner && !hasFinancialActivity);
  const shouldShowProtectedRecords = isOwner && hasFinancialActivity && !isGlobalAdmin;
  const tone = getStatusTone(tontine?.status ?? "draft");
  const openDebts = debts.filter((debt) => !debt.is_repaid);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: tontine?.name ?? t("Tontine") }} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error && !tontine ? (
        <AppCard><ThemedText>{error}</ThemedText><AppButton label={t("Try again")} onPress={() => void load()} /></AppCard>
      ) : tontine ? (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} tintColor={colors.accent} onRefresh={() => { setIsRefreshing(true); void load(); }} />}>
          <View
            style={[
              styles.page,
              layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
            ]}
          >
          <AppButton secondary label={t("Your tontines")} onPress={() => router.replace("/(tabs)/tontines")} />
          {error ? <AppCard><ThemedText>{error}</ThemedText><AppButton secondary label={t("Try again")} onPress={() => void load()} /></AppCard> : null}
          <AppCard>
            <View style={styles.groupHeaderTop}>
              <View style={styles.groupIcon}>
                <Ionicons name="people" size={22} color={BrandColors.blue} />
              </View>
              <View style={styles.groupIdentity}>
                <ThemedText style={[styles.groupEyebrow, { color: colors.muted }]}>{t("Tontine group")}</ThemedText>
                <ThemedText style={AppTypography.heading}>{tontine.name}</ThemedText>
              </View>
              <View
                style={[
                  styles.groupStatusBadge,
                  { backgroundColor: tone.lightBg, borderColor: tone.lightBorder },
                ]}
              >
                <ThemedText style={[styles.groupStatusText, { color: tone.lightText }]}>
                  {t(
                    tontine.status.charAt(0).toUpperCase() +
                      tontine.status.slice(1).toLowerCase()
                  )}
                </ThemedText>
              </View>
            </View>

            <View style={styles.groupMetaRow}>
              <View style={styles.groupMetaItem}>
                <ThemedText style={[styles.groupMetaValue, { color: colors.accent }]}>
                  {formatAmount(tontine.contribution_amount)}
                </ThemedText>
                <ThemedText style={[styles.groupMetaLabel, { color: colors.muted }]}>{t("Contribution")}</ThemedText>
              </View>
              <View style={styles.groupMetaDivider} />
              <View style={styles.groupMetaItem}>
                <ThemedText style={[styles.groupMetaValue, { color: colors.accent }]}>
                  {t("{{current}} of {{total}}", {
                    current: tontine.current_cycle,
                    total: tontine.total_cycles,
                  })}
                </ThemedText>
                <ThemedText style={[styles.groupMetaLabel, { color: colors.muted }]}>{t("Current cycle")}</ThemedText>
              </View>
              <View style={styles.groupMetaDivider} />
              <View style={styles.groupMetaItem}>
                <ThemedText style={[styles.groupMetaValue, { color: colors.accent }]}>
                  {t(
                    tontine.frequency.charAt(0).toUpperCase() +
                      tontine.frequency.slice(1).toLowerCase()
                  )}
                </ThemedText>
                <ThemedText style={[styles.groupMetaLabel, { color: colors.muted }]}>{t("Frequency")}</ThemedText>
              </View>
            </View>
          </AppCard>

          <AppCard style={{ backgroundColor: "#132D52", borderColor: "#132D52" }}>
            <ThemedText style={[AppTypography.caption, { color: "#CCDAEE" }]}>{t("Current cycle")}</ThemedText>
            <ThemedText style={[AppTypography.heading, { color: "#FFFFFF" }]}>
              {currentCycle ? t("Cycle {{current}} of {{total}}", { current: currentCycle.cycle_number, total: tontine.total_cycles }) : t(tontine.status === "completed" ? "Completed" : "No current cycle")}
            </ThemedText>
            {currentCycle ? <>
              <ThemedText style={{ color: "#CCDAEE" }}>{t("Due {{date}}", { date: Number.isNaN(Date.parse(currentCycle.end_date)) ? currentCycle.end_date : new Intl.DateTimeFormat(getCurrentLocale(), { month: "short", day: "numeric", year: "numeric" }).format(new Date(currentCycle.end_date)) })}</ThemedText>
              <AppButton label={t("View cycle details")} onPress={() => router.push({ pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]", params: { tontineId: String(tontine.id), cycleId: String(currentCycle.id) } })} />
            </> : <AppButton label={t("View cycles")} onPress={() => router.push({ pathname: "/(tabs)/tontines/[tontineId]/cycles", params: { tontineId: String(tontine.id) } })} />}
          </AppCard>

          <AppCard>
            <ThemedText style={AppTypography.section}>{t("Group activity")}</ThemedText>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/members",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={StyleSheet.flatten([styles.navigationRow, styles.navigationRowBorder])}
              >
                <View style={styles.navigationIcon}>
                  <Ionicons name="people-outline" size={21} color={BrandColors.blue} />
                </View>
                <View style={styles.navigationCopy}>
                  <ThemedText style={[styles.navigationTitle, { color: colors.accent }]}>{t("Members")}</ThemedText>
                  <ThemedText style={[styles.navigationSubtitle, { color: colors.muted }]}>
                    {t("{{count}} active", { count: activeMembers.length })}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BrandColors.muted} />
              </Pressable>
            </Link>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/cycles",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={StyleSheet.flatten([styles.navigationRow, styles.navigationRowBorder])}
              >
                <View style={styles.navigationIcon}>
                  <Ionicons name="repeat-outline" size={21} color={BrandColors.blue} />
                </View>
                <View style={styles.navigationCopy}>
                  <ThemedText style={[styles.navigationTitle, { color: colors.accent }]}>{t("Cycles")}</ThemedText>
                  <ThemedText style={[styles.navigationSubtitle, { color: colors.muted }]}>
                    {currentCycle
                      ? t("Cycle {{current}} of {{total}}", {
                          current: currentCycle.cycle_number,
                          total: tontine.total_cycles,
                        })
                      : t("No cycles generated")}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BrandColors.muted} />
              </Pressable>
            </Link>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/transactions",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={StyleSheet.flatten([styles.navigationRow, styles.navigationRowBorder])}
              >
                <View style={styles.navigationIcon}>
                  <Ionicons name="swap-horizontal-outline" size={21} color={BrandColors.blue} />
                </View>
                <View style={styles.navigationCopy}>
                  <ThemedText style={[styles.navigationTitle, { color: colors.accent }]}>{t("Transactions")}</ThemedText>
                  <ThemedText style={[styles.navigationSubtitle, { color: colors.muted }]}>
                    {t("{{count}} entries", {
                      count: transactionSummary?.transaction_count ?? 0,
                    })}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BrandColors.muted} />
              </Pressable>
            </Link>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/payouts",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={StyleSheet.flatten([styles.navigationRow, styles.navigationRowBorder])}
              >
                <View style={styles.navigationIcon}>
                  <Ionicons name="wallet-outline" size={21} color={BrandColors.blue} />
                </View>
                <View style={styles.navigationCopy}>
                  <ThemedText style={[styles.navigationTitle, { color: colors.accent }]}>{t("Payouts")}</ThemedText>
                  <ThemedText style={[styles.navigationSubtitle, { color: colors.muted }]}>
                    {t("Review payout history")}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BrandColors.muted} />
              </Pressable>
            </Link>

            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/debts",
                params: { tontineId: String(tontine.id) },
              }}
              asChild
            >
              <Pressable accessibilityRole="link" style={styles.navigationRow}>
                <View style={styles.navigationIcon}>
                  <Ionicons name="alert-circle-outline" size={21} color={BrandColors.blue} />
                </View>
                <View style={styles.navigationCopy}>
                  <ThemedText style={[styles.navigationTitle, { color: colors.accent }]}>{t("Debts")}</ThemedText>
                  <ThemedText style={[styles.navigationSubtitle, { color: colors.muted }]}>
                    {t("{{count}} open", { count: openDebts.length })}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BrandColors.muted} />
              </Pressable>
            </Link>
          </AppCard>

          {canManage ? (
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
              <Pressable accessibilityRole="button" disabled={isGenerating} style={styles.primaryAction} onPress={() => void onGenerateCycles()}>
                {isGenerating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.primaryActionText}>{t("Generate cycles")}</ThemedText>
                )}
              </Pressable>
            ) : null}

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
          </View>
          ) : null}

          {shouldShowProtectedRecords ? (
            <View style={styles.protectedCard}>
              <ThemedText style={styles.protectedTitle}>{t("Financial records preserved")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t(
                  "This tontine has financial activity and cannot be deleted. Its contributions, payouts, debts, and ledger history stay available for records."
                )}
              </ThemedText>
            </View>
          ) : canDeleteTontine ? (
            <View style={styles.dangerCard}>
              <ThemedText style={styles.dangerTitle}>{t("Delete tontine")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {isGlobalAdmin
                  ? t(
                      "As a global admin, you can delete this tontine even if financial activity already exists. This action cannot be undone."
                    )
                  : t("You can remove this tontine only when no financial activity has been recorded yet.")}
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
  groupHeader: {
    borderRadius: 24,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 18,
    ...BrandShadow,
  },
  groupHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46, 207, 227, 0.12)",
  },
  groupIdentity: {
    flex: 1,
    gap: 2,
  },
  groupEyebrow: {
    color: BrandColors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  groupName: {
    color: BrandColors.ink,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  groupStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupStatusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  groupMetaRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  groupMetaItem: {
    flex: 1,
    gap: 3,
  },
  groupMetaDivider: {
    width: 1,
    marginHorizontal: 10,
    backgroundColor: BrandColors.border,
  },
  groupMetaValue: {
    color: BrandColors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  groupMetaLabel: {
    color: BrandColors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  navigationCard: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    ...BrandShadow,
  },
  navigationLabel: {
    color: BrandColors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navigationRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    paddingVertical: 11,
  },
  navigationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  navigationIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46, 207, 227, 0.1)",
  },
  navigationCopy: {
    flex: 1,
    gap: 2,
  },
  navigationTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  navigationSubtitle: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 17,
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
  protectedCard: {
    borderRadius: 28,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 20,
    gap: 12,
    ...BrandShadow,
  },
  protectedTitle: {
    color: "#1D4ED8",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
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
  reliabilityScoreBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(46,207,227,0.1)",
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reliabilityScoreText: {
    color: BrandColors.inkSoft,
    fontSize: 12,
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
