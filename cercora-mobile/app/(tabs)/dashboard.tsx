import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { api } from "@/hooks/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

type Reminder = { cycle_id: number; tontine_id: number; tontine_name: string; deadline: string; is_overdue: boolean };
type Group = { id: number; name: string; current_cycle: number; total_cycles: number; status: string };

export default function Dashboard() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const colors = useSurfaceColors();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderError, setReminderError] = useState(false);
  const [groupError, setGroupError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const version = ++request.current;
    const [reminderResult, groupResult] = await Promise.allSettled([
      api.get<{ reminders: Reminder[] }>("/reminders/pre-deadline/me"),
      api.get<Group[]>("/tontines/"),
    ]);
    if (version !== request.current) return;
    setReminderError(reminderResult.status === "rejected");
    setGroupError(groupResult.status === "rejected");
    if (reminderResult.status === "fulfilled") setReminders(reminderResult.value.data.reminders ?? []);
    if (groupResult.status === "fulfilled") setGroups(groupResult.value.data);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]));
  const next = [...reminders].sort((a, b) => Number(b.is_overdue) - Number(a.is_overdue) || Date.parse(a.deadline) - Date.parse(b.deadline))[0];
  const active = groups.filter(group => group.status.toLowerCase() === "active");
  const preview = [...active, ...groups.filter(group => group.status.toLowerCase() !== "active")].slice(0, 3);
  function openGroup(id: number) {
    router.push({ pathname: "/(tabs)/tontines/[tontineId]", params: { tontineId: String(id) } });
  }
  function deadline(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t("View reminders") : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 120 }]}>
        <View style={[styles.page, layout.maxWidth ? { maxWidth: layout.maxWidth } : null]}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Your savings, together")}</ThemedText>
              <ThemedText style={AppTypography.heading}>{t("Hello, {{name}}", { name: user?.name?.split(" ")[0] || t("there") })}</ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("View reminders")} onPress={() => router.push("/(tabs)/reminders")} style={({ pressed }) => [styles.bell, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="notifications-outline" size={23} color={colors.accent} />
              {!reminderError && reminders.length > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          </View>
          <AppCard style={styles.hero}>
            <View style={styles.row}>
              <ThemedText style={[AppTypography.caption, styles.heroMuted]}>{t(!reminderError && next?.is_overdue ? "Contribution overdue" : "Next contribution")}</ThemedText>
              <Ionicons name="calendar-outline" size={22} color="#B9D3FF" />
            </View>
            {loading ? <LoadingBlocks /> : reminderError ? <>
              <ThemedText style={[AppTypography.section, styles.white]}>{t("Reminders are unavailable")}</ThemedText>
              <ThemedText style={styles.heroMuted}>{t("Pull down to try again.")}</ThemedText>
              <AppButton label={t("View reminders")} onPress={() => router.push("/(tabs)/reminders")} />
            </> : next ? <>
              <ThemedText style={[AppTypography.heading, styles.white]}>{next.tontine_name}</ThemedText>
              <ThemedText style={styles.heroMuted}>{t("Due {{date}}", { date: deadline(next.deadline) })}</ThemedText>
              <AppButton label={t("View cycle details")} onPress={() => router.push({ pathname: "/(tabs)/tontines/[tontineId]/cycles", params: { tontineId: String(next.tontine_id) } })} />
            </> : <>
              <Ionicons name="checkmark-circle-outline" size={36} color="#8AE0C5" />
              <ThemedText style={[AppTypography.heading, styles.white]}>{t("You are all caught up.")}</ThemedText>
              <ThemedText style={styles.heroMuted}>{t("No contribution reminders right now.")}</ThemedText>
              <AppButton label={t("Your tontines")} onPress={() => router.push("/(tabs)/tontines")} />
            </>}
          </AppCard>
          <View style={styles.stats}>
            <AppCard style={styles.flex}>
              <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Active tontines")}</ThemedText>
              <ThemedText style={AppTypography.heading}>{loading || groupError ? "—" : String(active.length)}</ThemedText>
            </AppCard>
            <AppCard style={styles.flex}>
              <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Reminders")}</ThemedText>
              <ThemedText style={AppTypography.heading}>{loading || reminderError ? "—" : String(reminders.length)}</ThemedText>
            </AppCard>
          </View>
          <View style={styles.section}>
            <View style={styles.row}>
              <ThemedText style={[AppTypography.section, styles.flex]}>{t("Your tontines")}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/tontines")} style={styles.textButton}><ThemedText style={{ color: colors.accent, fontWeight: "700" }}>{t("View all")}</ThemedText></Pressable>
            </View>
            {groupError ? <AppCard><ThemedText>{t("Could not refresh your tontines.")}</ThemedText><AppButton secondary label={t("Try again")} onPress={() => { void load(); }} /></AppCard> : null}
            {loading ? <AppCard><LoadingBlocks /></AppCard> : preview.length ? preview.map(group => {
              const progress = group.total_cycles > 0 ? Math.max(0, Math.min(1, group.current_cycle / group.total_cycles)) : 0;
              return <Pressable key={group.id} accessibilityRole="button" accessibilityLabel={group.name} onPress={() => openGroup(group.id)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <AppCard>
                  <View style={styles.row}>
                    <View style={[styles.groupIcon, { backgroundColor: colors.track }]}><Ionicons name="people-outline" size={23} color={colors.accent} /></View>
                    <View style={styles.flex}><ThemedText type="defaultSemiBold">{group.name}</ThemedText><ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t(group.status.charAt(0).toUpperCase() + group.status.slice(1).toLowerCase())}</ThemedText></View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>
                  <View accessible accessibilityRole="progressbar" accessibilityLabel={t("Cycle progress")} accessibilityValue={{ min: 0, max: group.total_cycles || 1, now: Math.max(0, Math.min(group.current_cycle, group.total_cycles || 1)) }} style={[styles.track, { backgroundColor: colors.track }]}><View style={[styles.fill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} /></View>
                  <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Cycle {{current}} of {{total}}", { current: group.current_cycle, total: group.total_cycles })}</ThemedText>
                </AppCard>
              </Pressable>;
            }) : !groupError ? <AppCard>
              <ThemedText style={AppTypography.section}>{t("Start your first circle")}</ThemedText>
              <ThemedText style={{ color: colors.muted }}>{t("Save together with people you trust.")}</ThemedText>
              <AppButton label={t("Create tontine")} onPress={() => router.push("/(tabs)/tontines/create")} />
            </AppCard> : null}
          </View>
          {groups.length > 0 ? <AppButton secondary label={t("Create tontine")} onPress={() => router.push("/(tabs)/tontines/create")} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
function LoadingBlocks() {
  const { t } = useI18n();
  const colors = useSurfaceColors();
  return <View accessible accessibilityLabel={t("Loading home")} accessibilityState={{ busy: true }} style={styles.skeleton}><View style={[styles.placeholder, { backgroundColor: colors.track, width: "72%" }]} /><View style={[styles.placeholder, { backgroundColor: colors.track, width: "45%" }]} /></View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: "center" },
  page: { width: "100%", gap: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  bell: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 11, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: "#E55465" },
  hero: { backgroundColor: "#132D52", borderColor: "#132D52", padding: 24, gap: 18 },
  heroMuted: { color: "#CCDAEE" },
  white: { color: "#FFFFFF" },
  stats: { flexDirection: "row", gap: 12 },
  section: { gap: 12 },
  textButton: { minHeight: 48, justifyContent: "center", paddingLeft: 8 },
  groupIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  skeleton: { gap: 14, paddingVertical: 12 },
  placeholder: { height: 20, borderRadius: 6 },
});
