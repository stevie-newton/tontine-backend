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

type Tontine = {
  id: number;
  owner_id: number;
};

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function TontineMembersScreen() {
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const id = useMemo(() => Number(tontineId), [tontineId]);
  const { user } = useAuth();
  const { t } = useI18n();

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [items, setItems] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tontineRes, membersRes] = await Promise.all([
        api.get<Tontine>(`/tontines/${id}`),
        api.get<Member[]>(`/tontine-memberships/tontine/${id}/members`),
      ]);
      setTontine(tontineRes.data);
      setItems(membersRes.data ?? []);
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
        setError(t("Invalid tontine id."));
        setIsLoading(false);
        return;
      }
      void load();
    }, [id, load, t])
  );

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
  }

  const myMembership = user ? items.find((member) => member.id === user.id) ?? null : null;
  const canInvite =
    Boolean(user) &&
    (tontine?.owner_id === user?.id || myMembership?.membership_role === "admin");
  const activeMembers = items.filter((member) => member.membership_status === "active");
  const pendingMembers = items.filter((member) => member.membership_status !== "active");
  const adminCount = items.filter((member) => member.membership_role === "admin").length;

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <Stack.Screen options={{ title: t("Members") }} />

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

            <ThemedText style={styles.eyebrow}>{t("Roster")}</ThemedText>
            <ThemedText style={styles.heroTitle}>{t("Members and roles")}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {t("Keep track of who is active, who is still pending, and who helps manage the tontine.")}
            </ThemedText>

            <View style={styles.heroBadges}>
              <View style={styles.heroBadgeCool}>
                <ThemedText style={styles.heroBadgeCoolText}>{t("{{count}} active", { count: activeMembers.length })}</ThemedText>
              </View>
              <View style={styles.heroBadgeWarm}>
                <ThemedText style={styles.heroBadgeWarmText}>{t("{{count}} pending", { count: pendingMembers.length })}</ThemedText>
              </View>
              <View style={styles.heroBadgeNeutral}>
                <ThemedText style={styles.heroBadgeNeutralText}>{t("{{count}} admins", { count: adminCount })}</ThemedText>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{items.length}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Total members")}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{canInvite ? t("Yes") : t("No")}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Can invite")}</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {user && tontine?.owner_id === user.id ? t("Owner") : t(myMembership?.membership_role ?? "Member")}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>{t("Your role")}</ThemedText>
              </View>
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          {canInvite ? (
            <Link
              href={{
                pathname: "/(tabs)/tontines/[tontineId]/invite",
                params: { tontineId: String(id) },
              }}
              asChild
            >
              <Pressable style={styles.primaryAction}>
                <ThemedText style={styles.primaryActionText}>{t("Invite member")}</ThemedText>
              </Pressable>
            </Link>
          ) : (
            <View style={styles.infoBanner}>
              <ThemedText style={styles.infoBannerText}>
                {t("Only the owner or an admin can send invites for this tontine.")}
              </ThemedText>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">{t("Team overview")}</ThemedText>
              <ThemedText style={styles.supportText}>{t("{{count}} people", { count: items.length })}</ThemedText>
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{activeMembers.length}</ThemedText>
                <ThemedText style={styles.metricLabel}>{t("Active")}</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{pendingMembers.length}</ThemedText>
                <ThemedText style={styles.metricLabel}>{t("Pending")}</ThemedText>
              </View>
              <View style={styles.metricTile}>
                <ThemedText style={styles.metricValue}>{adminCount}</ThemedText>
                <ThemedText style={styles.metricLabel}>{t("Admins")}</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">{t("Roster")}</ThemedText>
              <ThemedText style={styles.supportText}>{t("{{count}} active first", { count: activeMembers.length })}</ThemedText>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>{t("No members yet")}</ThemedText>
                <ThemedText style={styles.supportText}>
                  {t("Invite someone to join this tontine and start building the rotation.")}
                </ThemedText>
              </View>
            ) : (
              [...activeMembers, ...pendingMembers].map((item) => {
                const isAdmin = item.membership_role === "admin";
                const isPending = item.membership_status !== "active";
                return (
                  <View key={item.membership_id} style={styles.memberCard}>
                    <View style={styles.memberHeader}>
                      <View style={styles.memberHeading}>
                        <ThemedText style={styles.memberName}>{item.name}</ThemedText>
                        <ThemedText style={styles.supportText}>{item.phone}</ThemedText>
                      </View>

                      <View style={styles.memberBadges}>
                        <View
                          style={[
                            styles.badge,
                            isPending ? styles.badgePending : styles.badgeActive,
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.badgeText,
                              isPending ? styles.badgePendingText : styles.badgeActiveText,
                            ]}
                          >
                            {t(item.membership_status)}
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.badge,
                            isAdmin ? styles.badgeAdmin : styles.badgeNeutral,
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.badgeText,
                              isAdmin ? styles.badgeAdminText : styles.badgeNeutralText,
                            ]}
                          >
                            {t(item.membership_role)}
                          </ThemedText>
                        </View>
                      </View>
                    </View>

                    <View style={styles.metricGrid}>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>
                          {item.payout_position ?? "-"}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>{t("Payout order")}</ThemedText>
                      </View>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>
                          {item.rotation_position ?? "-"}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>{t("Rotation")}</ThemedText>
                      </View>
                      <View style={styles.metricTileCompact}>
                        <ThemedText style={styles.metricValueCompact}>
                          {formatShortDate(item.joined_at)}
                        </ThemedText>
                        <ThemedText style={styles.metricLabel}>{t("Joined")}</ThemedText>
                      </View>
                    </View>
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
    textTransform: "capitalize",
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
    minWidth: 96,
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
  memberCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 10,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  memberHeading: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  memberBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeActive: {
    backgroundColor: "#ECFDF3",
    borderColor: "#ABEFC6",
  },
  badgePending: {
    backgroundColor: "#FFFAEB",
    borderColor: "#FEDF89",
  },
  badgeAdmin: {
    backgroundColor: "#EFF8FF",
    borderColor: "#B2DDFF",
  },
  badgeNeutral: {
    backgroundColor: "#F2F4F7",
    borderColor: "#D0D5DD",
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  badgeActiveText: {
    color: "#067647",
  },
  badgePendingText: {
    color: "#B54708",
  },
  badgeAdminText: {
    color: "#175CD3",
  },
  badgeNeutralText: {
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
