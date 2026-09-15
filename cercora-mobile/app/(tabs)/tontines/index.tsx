import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Link } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

type Tontine = {
  id: number;
  name: string;
  contribution_amount: number | string;
  total_cycles: number;
  current_cycle: number;
  status: string;
  frequency?: string | null;
};

function formatAmount(value: number | string) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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
  const layout = useResponsiveLayout();
  const { t } = useI18n();
  const [items, setItems] = useState<Tontine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get<Tontine[]>("/tontines/");
      setItems(response.data);
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

  return (
    <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
      <BrandBackdrop />
      <FlatList
        data={items}
        numColumns={layout.isTablet ? 2 : 1}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.content}
        columnWrapperStyle={layout.isTablet ? styles.groupRow : undefined}
        ListHeaderComponent={
          <View
            style={[
              styles.headerWrap,
              layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
            ]}
          >
            <View style={styles.pageHeader}>
              <View style={styles.pageHeaderText}>
                <ThemedText style={styles.pageTitle}>{t("Your tontines")}</ThemedText>
                <ThemedText style={styles.pageSubtitle}>
                  {t("Open a group or create a new savings circle.")}
                </ThemedText>
              </View>
              <Link href="/(tabs)/tontines/create" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.createButton,
                    pressed ? styles.createButtonPressed : null,
                  ]}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.createButtonText}>{t("Create tontine")}</ThemedText>
                </Pressable>
              </Link>
            </View>

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <View style={styles.listHeaderRow}>
              <ThemedText style={styles.listHeading}>{t("Your groups")}</ThemedText>
              {!isLoading ? (
                <ThemedText style={styles.groupCount}>
                  {t("{{count}} group(s)", { count: items.length })}
                </ThemedText>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View
              style={[
                styles.loadingState,
                layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
              ]}
            >
              <ActivityIndicator />
              <ThemedText style={styles.supportText}>{t("Loading your tontines...")}</ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.emptyState,
                layout.maxWidth ? { maxWidth: layout.maxWidth } : null,
              ]}
            >
              <ThemedText style={styles.emptyTitle}>{t("No tontines yet")}</ThemedText>
              <ThemedText style={styles.supportText}>
                {t("Create your first savings group to invite members and start building your rotation.")}
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => {
          const tone = getStatusTone(item.status);

          return (
            <View
              style={[
                styles.groupCardWrap,
                layout.isTablet ? styles.groupCardWrapTablet : null,
              ]}
            >
              <Link
                href={{
                  pathname: "/(tabs)/tontines/[tontineId]",
                  params: { tontineId: String(item.id) },
                }}
                asChild
              >
                <Pressable style={styles.groupCard}>
                  <View style={styles.groupTopRow}>
                    <View style={styles.groupTitleWrap}>
                      <ThemedText style={styles.groupTitle}>{item.name}</ThemedText>
                      <ThemedText style={styles.groupMeta}>
                        {item.frequency
                          ? t("{{frequency}} contribution cadence", {
                              frequency: t(
                                item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1).toLowerCase()
                              ).toLowerCase(),
                            })
                          : t("Custom contribution cadence")}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <ThemedText style={[styles.statusBadgeText, { color: tone.text }]}>
                        {t(item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase())}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.groupStats}>
                    <ThemedText style={styles.groupStatText}>
                      {t("Contribution: {{amount}}", {
                        amount: formatAmount(item.contribution_amount),
                      })}
                    </ThemedText>
                    <ThemedText style={styles.groupStatText}>
                      {t("Cycle: {{current}}/{{total}}", {
                        current: item.current_cycle,
                        total: item.total_cycles,
                      })}
                    </ThemedText>
                  </View>

                  <ThemedText style={styles.openLink}>{t("Open group")}</ThemedText>
                </Pressable>
              </Link>
            </View>
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
    paddingBottom: 128,
    alignItems: "center",
  },
  headerWrap: {
    width: "100%",
    gap: 16,
  },
  groupRow: {
    width: "100%",
    maxWidth: 980,
    gap: 16,
    justifyContent: "space-between",
  },
  groupCardWrap: {
    width: "100%",
    marginTop: 16,
  },
  groupCardWrapTablet: {
    flex: 1,
    maxWidth: 482,
  },
  pageHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pageHeaderText: {
    flex: 1,
    gap: 4,
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
  createButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: BrandColors.blueDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...BrandShadow,
  },
  createButtonPressed: {
    opacity: 0.84,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  groupCount: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  overviewCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: BrandColors.blueNight,
    padding: 24,
    gap: 16,
    ...BrandShadow,
  },
  overviewGlowA: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: BrandColors.blue,
    opacity: 0.28,
  },
  overviewGlowB: {
    position: "absolute",
    left: -16,
    bottom: -46,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.18,
  },
  eyebrow: {
    color: "#D7E7FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  overviewTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  overviewSubtitle: {
    color: "#D9E6FF",
    fontSize: 14,
    lineHeight: 21,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryTile: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    padding: 15,
    gap: 4,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#CFE0FF",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 12,
    ...BrandShadow,
  },
  invitesCard: {
    borderRadius: 28,
    backgroundColor: "rgba(255, 247, 237, 0.92)",
    borderWidth: 1,
    borderColor: "#F7D9A6",
    padding: 20,
    gap: 12,
    ...BrandShadow,
  },
  sectionTitle: {
    color: BrandColors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  sectionSubtitle: {
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
    minWidth: 130,
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
  invitesList: {
    gap: 10,
  },
  inviteItem: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#F2C97D",
    padding: 15,
    gap: 12,
  },
  inviteText: {
    gap: 3,
  },
  inviteTitle: {
    color: BrandColors.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
  },
  inviteMeta: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  rejectButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.dangerBorder,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  inlineLink: {
    alignSelf: "flex-start",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: "rgba(16,36,72,0.08)",
  },
  inlineLinkText: {
    color: BrandColors.inkSoft,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  listHeading: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  loadingState: {
    width: "100%",
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyState: {
    width: "100%",
    borderRadius: 24,
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
  groupCard: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 20,
    gap: 13,
    minHeight: 0,
    ...BrandShadow,
  },
  groupTopRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
  },
  groupTitleWrap: {
    width: "100%",
    gap: 4,
  },
  groupTitle: {
    color: BrandColors.ink,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  groupMeta: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    alignSelf: "flex-start",
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
  groupStats: {
    gap: 4,
  },
  groupStatText: {
    color: BrandColors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  openLink: {
    color: BrandColors.blue,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  error: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  success: {
    color: BrandColors.successText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
