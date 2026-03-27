import { useFocusEffect } from "@react-navigation/native";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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
  owner_id: number;
};

type Member = {
  membership_id: number;
  id: number;
  name: string;
  membership_role: string;
  membership_status: "active" | "pending" | string;
};

type Cycle = {
  id: number;
  cycle_number: number;
  is_closed: boolean;
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
  amount: string | number;
  is_repaid: boolean;
  notes: string | null;
  created_at: string;
  repaid_at: string | null;
};

type DebtListResponse = {
  tontine_id: number;
  count: number;
  debts: Debt[];
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

export default function DebtsScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const tontineNum = useMemo(() => Number(tontineId), [tontineId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [debtorMembershipId, setDebtorMembershipId] = useState<number | null>(null);
  const [covererMembershipId, setCovererMembershipId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmittingCover, setIsSubmittingCover] = useState(false);
  const [repayingDebtId, setRepayingDebtId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setActionError(null);
    setActionMessage(null);

    try {
      const [tontineRes, membersRes, cyclesRes, debtsRes] = await Promise.all([
        api.get<Tontine>(`/tontines/${tontineNum}`),
        api.get<Member[]>(`/tontine-memberships/tontine/${tontineNum}/members`),
        api.get<Cycle[]>(`/tontine-cycles/tontine/${tontineNum}`),
        api.get<DebtListResponse>(`/debts/tontine/${tontineNum}`),
      ]);

      setTontine(tontineRes.data);
      setMembers(membersRes.data ?? []);
      setCycles(cyclesRes.data ?? []);
      setDebts(debtsRes.data.debts ?? []);

      setSelectedCycleId((prev) => {
        if (prev) return prev;
        const openCycle = (cyclesRes.data ?? []).find((cycle) => !cycle.is_closed);
        return openCycle?.id ?? null;
      });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tontineNum]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(tontineNum)) {
        setIsLoading(false);
        setError("Invalid tontine id.");
        return;
      }
      void load();
    }, [load, tontineNum])
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
  const openCycles = cycles.filter((cycle) => !cycle.is_closed);
  const openDebts = debts.filter((debt) => !debt.is_repaid);
  const repaidDebts = debts.filter((debt) => debt.is_repaid);

  const summary = useMemo(() => {
    const totalAmount = debts.reduce((sum, debt) => {
      const amount = typeof debt.amount === "number" ? debt.amount : Number(debt.amount);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    return {
      total: debts.length,
      open: openDebts.length,
      repaid: repaidDebts.length,
      totalAmount,
    };
  }, [debts, openDebts.length, repaidDebts.length]);

  const cycleNumberById = useMemo(() => {
    const map = new Map<number, number>();
    for (const cycle of cycles) map.set(cycle.id, cycle.cycle_number);
    return map;
  }, [cycles]);

  async function submitCoverPayment() {
    if (!tontine) return;
    if (!selectedCycleId) {
      setActionError("Select a cycle.");
      return;
    }
    if (!debtorMembershipId || !covererMembershipId) {
      setActionError("Select debtor and coverer.");
      return;
    }
    if (debtorMembershipId === covererMembershipId) {
      setActionError("Debtor and coverer must be different.");
      return;
    }

    setIsSubmittingCover(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await api.post("/debts/cover-payment", {
        cycle_id: selectedCycleId,
        debtor_membership_id: debtorMembershipId,
        coverer_membership_id: covererMembershipId,
        amount: String(tontine.contribution_amount),
        notes: notes.trim() ? notes.trim() : null,
      });
      setActionMessage("Cover payment recorded. Debt created.");
      setNotes("");
      await load();
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setIsSubmittingCover(false);
    }
  }

  async function repayDebt(debtId: number) {
    setRepayingDebtId(debtId);
    setActionError(null);
    setActionMessage(null);
    try {
      await api.post(`/debts/${debtId}/repay`);
      setActionMessage("Debt marked as repaid.");
      await load();
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setRepayingDebtId(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
        <BrandBackdrop />
        <Stack.Screen options={{ title: t("Debts") }} />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>Debt ledger</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              A mobile version of the web debt flow, with coverage creation, open balances, and repayment history in one place.
            </ThemedText>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>Coverage ledger</ThemedText>
            <ThemedText style={styles.heroTitle}>
              {tontine?.name ?? "Tontine"} debt flow
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Track when someone covers a missed payment and follow repayment back to resolution.
            </ThemedText>

            <View style={styles.heroBadges}>
              <View style={styles.heroBadgeWarm}>
                <ThemedText style={styles.heroBadgeWarmText}>{summary.open} open</ThemedText>
              </View>
              <View style={styles.heroBadgeCool}>
                <ThemedText style={styles.heroBadgeCoolText}>{summary.repaid} repaid</ThemedText>
              </View>
              {canManage ? (
                <View style={styles.heroBadgeNeutral}>
                  <ThemedText style={styles.heroBadgeNeutralText}>
                    {isOwner ? "Owner controls" : "Admin controls"}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{summary.total}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Total debts</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{formatAmount(summary.totalAmount)}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Tracked amount</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {tontine ? formatAmount(tontine.contribution_amount) : "-"}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Standard contribution</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          {canManage ? (
            <View style={styles.card}>
              <ThemedText type="subtitle">Record cover payment</ThemedText>
              <ThemedText style={styles.supportText}>
                This creates a confirmed contribution for the missed cycle and opens a debt for repayment.
              </ThemedText>

              {actionError ? <ThemedText style={styles.errorInline}>{actionError}</ThemedText> : null}
              {actionMessage ? <ThemedText style={styles.ok}>{actionMessage}</ThemedText> : null}

              <ThemedText style={styles.sectionLabel}>Open cycle</ThemedText>
              <View style={styles.pillsRow}>
                {openCycles.length === 0 ? (
                  <View style={styles.infoBanner}>
                    <ThemedText style={styles.infoBannerText}>No open cycles available.</ThemedText>
                  </View>
                ) : (
                  openCycles.map((cycle) => (
                    <Pressable
                      key={cycle.id}
                      style={[
                        styles.pill,
                        selectedCycleId === cycle.id ? styles.pillActive : null,
                      ]}
                      onPress={() => setSelectedCycleId(cycle.id)}
                    >
                      <ThemedText
                        style={[
                          styles.pillText,
                          selectedCycleId === cycle.id ? styles.pillTextActive : null,
                        ]}
                      >
                        Cycle {cycle.cycle_number}
                      </ThemedText>
                    </Pressable>
                  ))
                )}
              </View>

              <ThemedText style={styles.sectionLabel}>Debtor</ThemedText>
              <View style={styles.pillsRow}>
                {activeMembers.map((member) => (
                  <Pressable
                    key={member.membership_id}
                    style={[
                      styles.pill,
                      debtorMembershipId === member.membership_id ? styles.pillActive : null,
                    ]}
                    onPress={() => setDebtorMembershipId(member.membership_id)}
                  >
                    <ThemedText
                      style={[
                        styles.pillText,
                        debtorMembershipId === member.membership_id ? styles.pillTextActive : null,
                      ]}
                    >
                      {member.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.sectionLabel}>Coverer</ThemedText>
              <View style={styles.pillsRow}>
                {activeMembers
                  .filter((member) => member.membership_id !== debtorMembershipId)
                  .map((member) => (
                    <Pressable
                      key={member.membership_id}
                      style={[
                        styles.pill,
                        covererMembershipId === member.membership_id ? styles.pillActive : null,
                      ]}
                      onPress={() => setCovererMembershipId(member.membership_id)}
                    >
                      <ThemedText
                        style={[
                          styles.pillText,
                          covererMembershipId === member.membership_id ? styles.pillTextActive : null,
                        ]}
                      >
                        {member.name}
                      </ThemedText>
                    </Pressable>
                  ))}
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>
                    {selectedCycleId ? `Cycle ${cycleNumberById.get(selectedCycleId) ?? selectedCycleId}` : "None"}
                  </ThemedText>
                  <ThemedText style={styles.metricLabel}>Selected cycle</ThemedText>
                </View>
                <View style={styles.metricTile}>
                  <ThemedText style={styles.metricValue}>
                    {tontine ? formatAmount(tontine.contribution_amount) : "-"}
                  </ThemedText>
                  <ThemedText style={styles.metricLabel}>Debt amount</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.sectionLabel}>Notes</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("Reason or context for this cover payment")}
                placeholderTextColor="#98A2B3"
                style={styles.input}
                multiline
              />

              <Pressable
                style={styles.primaryButton}
                disabled={isSubmittingCover}
                onPress={() => void submitCoverPayment()}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {isSubmittingCover ? "Saving..." : "Record cover payment"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Open debts</ThemedText>
              <ThemedText style={styles.supportText}>{openDebts.length} active</ThemedText>
            </View>

            {openDebts.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>{t("No dept")}</ThemedText>
              </View>
            ) : (
              openDebts.map((item) => {
                const cycleNo = cycleNumberById.get(item.cycle_id) ?? item.cycle_id;
                const isBusy = repayingDebtId === item.id;
                return (
                  <View key={item.id} style={styles.debtCard}>
                    <View style={styles.debtHeader}>
                      <View style={styles.debtHeading}>
                        <ThemedText style={styles.debtTitle}>
                          {item.debtor_name} owes {item.coverer_name}
                        </ThemedText>
                        <ThemedText style={styles.supportText}>Cycle {cycleNo}</ThemedText>
                      </View>
                      <View style={styles.statusBadgeWarm}>
                        <ThemedText style={styles.statusBadgeWarmText}>open</ThemedText>
                      </View>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>{formatAmount(item.amount)}</ThemedText>
                        <ThemedText style={styles.metricLabel}>Amount</ThemedText>
                      </View>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>{formatShortDate(item.created_at)}</ThemedText>
                        <ThemedText style={styles.metricLabel}>Created</ThemedText>
                      </View>
                    </View>

                    {item.notes ? (
                      <ThemedText style={styles.supportText}>Notes: {item.notes}</ThemedText>
                    ) : null}

                    {canManage ? (
                      <Pressable
                        style={styles.secondaryButton}
                        disabled={isBusy}
                        onPress={() => void repayDebt(item.id)}
                      >
                        <ThemedText style={styles.secondaryButtonText}>
                          {isBusy ? "Updating..." : "Mark repaid"}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Repaid history</ThemedText>
              <ThemedText style={styles.supportText}>{repaidDebts.length} resolved</ThemedText>
            </View>

            {repaidDebts.length === 0 ? (
              <ThemedText style={styles.supportText}>
                Repaid debts will appear here once they are closed out.
              </ThemedText>
            ) : (
              repaidDebts.map((item) => {
                const cycleNo = cycleNumberById.get(item.cycle_id) ?? item.cycle_id;
                return (
                  <View key={item.id} style={styles.debtCardMuted}>
                    <View style={styles.debtHeader}>
                      <View style={styles.debtHeading}>
                        <ThemedText style={styles.debtTitle}>
                          {item.debtor_name} repaid {item.coverer_name}
                        </ThemedText>
                        <ThemedText style={styles.supportText}>
                          Cycle {cycleNo} • Repaid {formatShortDate(item.repaid_at)}
                        </ThemedText>
                      </View>
                      <View style={styles.statusBadgeCool}>
                        <ThemedText style={styles.statusBadgeCoolText}>repaid</ThemedText>
                      </View>
                    </View>

                    <ThemedText style={styles.supportText}>
                      Amount: {formatAmount(item.amount)}
                    </ThemedText>
                    {item.notes ? (
                      <ThemedText style={styles.supportText}>Notes: {item.notes}</ThemedText>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
          </ScrollView>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
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
    top: -26,
    right: -18,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.24,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -12,
    bottom: -60,
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
  input: {
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 92,
    backgroundColor: "rgba(255,255,255,0.88)",
    textAlignVertical: "top",
    color: BrandColors.ink,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 14,
    alignItems: "center",
    ...BrandShadow,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
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
  debtCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  debtCardMuted: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 8,
  },
  debtHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  debtHeading: {
    flex: 1,
    gap: 2,
  },
  debtTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  statusBadgeWarm: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FEDF89",
    backgroundColor: "#FFFAEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeWarmText: {
    color: "#B54708",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statusBadgeCool: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ABEFC6",
    backgroundColor: "#ECFDF3",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeCoolText: {
    color: "#067647",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
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
  ok: {
    color: BrandColors.successText,
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: BrandColors.dangerText,
    fontWeight: "700",
    fontSize: 14,
    paddingHorizontal: 4,
  },
  errorInline: {
    color: BrandColors.dangerText,
    fontWeight: "700",
    fontSize: 14,
  },
});
