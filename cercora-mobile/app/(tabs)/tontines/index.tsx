import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { api } from "@/hooks/api-client";
import { useI18n } from "@/hooks/use-i18n";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

type Tontine = { id: number; name: string; contribution_amount: number | string; total_cycles: number; current_cycle: number; status: string; frequency?: string | null };
type Filter = "All" | "Active" | "Completed";

export default function TontinesListScreen() {
  const { t, locale } = useI18n();
  const colors = useSurfaceColors();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Tontine[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const version = ++request.current;
    try {
      const response = await api.get<Tontine[]>("/tontines/");
      if (version !== request.current) return;
      setItems(response.data);
      setError(false);
    } catch {
      if (version === request.current) setError(true);
    } finally {
      if (version === request.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current += 1; }; }, [load]));
  const visible = items.filter(item => (filter === "All" || item.status.toLowerCase() === filter.toLowerCase()) && item.name.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));
  return <View collapsable={false} style={[styles.screen, { backgroundColor: colors.background }]}>
    <FlatList
      key={layout.isTablet ? "tablet" : "phone"}
      data={visible}
      numColumns={layout.isTablet ? 2 : 1}
      keyExtractor={item => String(item.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120, maxWidth: layout.maxWidth || 640 }]}
      columnWrapperStyle={layout.isTablet ? styles.columns : undefined}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={<View style={styles.header}>
        <ThemedText style={AppTypography.heading}>{t("Your tontines")}</ThemedText>
        <ThemedText style={{ color: colors.muted }}>{t("Save together with people you trust.")}</ThemedText>
        <AppButton label={t("Create tontine")} onPress={() => router.push("/(tabs)/tontines/create")} />
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={21} color={colors.muted} />
          <TextInput accessibilityLabel={t("Search tontines")} placeholder={t("Search tontines")} placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" style={[AppTypography.body, styles.input, { color: colors.accent }]} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel={t("Clear search")} onPress={() => setQuery("")} style={styles.clear}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable> : null}
        </View>
        <View style={styles.filters}>{(["All", "Active", "Completed"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={({ pressed }) => [styles.filter, { backgroundColor: filter === value ? colors.accent : colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><ThemedText style={{ color: filter === value ? colors.background : colors.muted, fontWeight: "700" }}>{t(value)}</ThemedText></Pressable>)}</View>
        {error ? <AppCard><ThemedText>{t("Could not refresh your tontines.")}</ThemedText><AppButton secondary label={t("Try again")} onPress={() => { void load(); }} /></AppCard> : null}
        {!loading ? <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("{{count}} group(s)", { count: visible.length })}</ThemedText> : null}
      </View>}
      ListEmptyComponent={loading ? <AppCard><ActivityIndicator color={colors.accent} /><ThemedText>{t("Loading your tontines...")}</ThemedText></AppCard> : error ? null : <AppCard>
        <Ionicons name="people-outline" size={32} color={colors.accent} />
        <ThemedText style={AppTypography.section}>{t(items.length ? "No matching tontines" : "No tontines yet")}</ThemedText>
        <ThemedText style={{ color: colors.muted }}>{t(items.length ? "Try another name or filter." : "Create your first savings group to invite members and start building your rotation.")}</ThemedText>
        {items.length ? <AppButton secondary label={t("Reset filters")} onPress={() => { setQuery(""); setFilter("All"); }} /> : null}
      </AppCard>}
      renderItem={({ item }) => {
        const progress = item.total_cycles > 0 ? Math.max(0, Math.min(1, item.current_cycle / item.total_cycles)) : 0;
        const amount = Number(item.contribution_amount);
        return <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => router.push({ pathname: "/(tabs)/tontines/[tontineId]", params: { tontineId: String(item.id) } })} style={({ pressed }) => [styles.item, layout.isTablet ? styles.tabletItem : null, { opacity: pressed ? 0.7 : 1 }]}>
          <AppCard>
            <View style={styles.row}><Ionicons name="people-outline" size={24} color={colors.accent} /><View style={[styles.badge, { backgroundColor: colors.track }]}><ThemedText style={[AppTypography.caption, { color: colors.accent }]}>{t(item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase())}</ThemedText></View></View>
            <ThemedText style={AppTypography.section}>{item.name}</ThemedText>
            <View><ThemedText style={AppTypography.heading}>{Number.isFinite(amount) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount) : "—"}</ThemedText><ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Contribution")}{item.frequency ? ` · ${t(item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1).toLowerCase())}` : ""}</ThemedText></View>
            <View accessible accessibilityRole="progressbar" accessibilityLabel={t("Cycle progress")} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={[styles.track, { backgroundColor: colors.track }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} /></View>
            <View style={styles.row}><ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Cycle {{current}} of {{total}}", { current: item.current_cycle, total: item.total_cycles })}</ThemedText><Ionicons name="arrow-forward" size={20} color={colors.accent} /></View>
          </AppCard>
        </Pressable>;
      }}
    />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, width: "100%", alignSelf: "center" }, header: { gap: 16, marginBottom: 16 },
  columns: { gap: 16 }, item: { marginBottom: 16, width: "100%" }, tabletItem: { width: "48%", flexGrow: 0, flexShrink: 1 },
  search: { flexDirection: "row", alignItems: "center", paddingLeft: 14, borderWidth: 1, borderRadius: 14, minHeight: 52 },
  input: { flex: 1, minWidth: 0, padding: 12 }, clear: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, filter: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" }, fill: { height: "100%", borderRadius: 3 },
});
