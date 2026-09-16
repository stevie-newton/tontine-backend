import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Link, Stack } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { ThemedText } from "@/components/themed-text";
import { BrandColors } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import {
  disableNativePush,
  enableNativePush,
  getNativePushStatus,
  NATIVE_PUSH_SUPPORTED,
} from "@/hooks/native-push";
import { getErrorMessage } from "@/hooks/error-utils";
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

const WEB_PUSH_VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "";

type Reminder = {
  cycle_id: number;
  tontine_id: number;
  tontine_name: string;
  cycle_number: number;
  deadline: string;
  hours_remaining: number;
  is_overdue: boolean;
  hours_overdue: number;
};

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function RemindersScreen() {
  const { t } = useI18n();
  const colors = useSurfaceColors();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const request = useRef(0);
  const nativePushSupported = NATIVE_PUSH_SUPPORTED;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const webPushSupported = useMemo(() => {
    if (Platform.OS !== "web") return false;
    const w = globalThis as any;
    const hasNotification = typeof w.Notification !== "undefined";
    const hasServiceWorker = typeof w.navigator?.serviceWorker !== "undefined";
    const hasPushManager = typeof w.PushManager !== "undefined";
    const isSecure = Boolean(w.isSecureContext);
    return hasNotification && hasServiceWorker && hasPushManager && isSecure;
  }, []);

  const [permission, setPermission] = useState<
    "unsupported" | NotificationPermission
  >(() => {
    if (!webPushSupported) return "unsupported";
    return (globalThis as any).Notification.permission as NotificationPermission;
  });
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    const version = ++request.current;
    try {
      const res = await api.get<{ reminders: Reminder[] }>("/reminders/pre-deadline/me");
      if (version !== request.current) return;
      setReminders(res.data.reminders ?? []);
      setRemindersError(null);
    } catch (e) {
      if (version === request.current) setRemindersError(getErrorMessage(e));
    } finally {
      if (version === request.current) {
        setRemindersLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void loadReminders();
    return () => { request.current += 1; };
  }, [loadReminders]));

  useEffect(() => {
    if (nativePushSupported || !webPushSupported) return;
    setPermission(
      (globalThis as any).Notification.permission as NotificationPermission
    );
  }, [nativePushSupported, webPushSupported]);

  const refreshPushSubscriptionState = useCallback(async () => {
    if (nativePushSupported) {
      try {
        const status = await getNativePushStatus();
        setPushSubscribed(status.subscribed);
      } catch {
        setPushSubscribed(false);
      }
      return;
    }
    if (!webPushSupported) return;
    try {
      const reg = await (globalThis as any).navigator.serviceWorker.getRegistration();
      if (!reg) {
        setPushSubscribed(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    } catch {
      setPushSubscribed(false);
    }
  }, [nativePushSupported, webPushSupported]);

  useEffect(() => {
    void refreshPushSubscriptionState();
  }, [refreshPushSubscriptionState]);

  const overdueCount = reminders.filter((reminder) => reminder.is_overdue).length;

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = (globalThis as any).atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function onRefresh() {
    setIsRefreshing(true);
    await loadReminders();
  }

  async function enablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      if (nativePushSupported) {
        const result = await enableNativePush();
        setPushSubscribed(result.subscribed);
        if (result.message) {
          setPushError(t(result.message));
        }
        return;
      }

      if (!webPushSupported) return;
      const next = (await (globalThis as any).Notification.requestPermission()) as NotificationPermission;
      setPermission(next);
      if (next !== "granted") {
        setPushError("Notification permission not granted.");
        return;
      }
      if (!WEB_PUSH_VAPID_PUBLIC_KEY) {
        setPushError("Missing EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
        return;
      }
      const navigatorAny = (globalThis as any).navigator;
      const reg = await navigatorAny.serviceWorker.register("/service-worker.js");
      await navigatorAny.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
        });
      }
      await api.post("/push/subscribe", sub.toJSON());
      await AsyncStorage.setItem("push.web.enabled", "true");
      await refreshPushSubscriptionState();
    } catch (e) {
      setPushError(getErrorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      if (nativePushSupported) {
        await disableNativePush();
        setPushSubscribed(false);
        return;
      }

      if (!webPushSupported) return;
      const reg = await (globalThis as any).navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) {
        setPushSubscribed(false);
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await api.post("/push/unsubscribe", { endpoint });
      await AsyncStorage.removeItem("push.web.enabled");
      await refreshPushSubscriptionState();
    } catch (e) {
      setPushError(getErrorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }

  function getReminderUrgencyText(reminder: Reminder) {
    if (reminder.is_overdue) {
      if (reminder.hours_overdue > 0) {
        return t("{{count}}h late", { count: reminder.hours_overdue });
      }
      return t("Overdue");
    }
    if (reminder.hours_remaining > 0) {
      return t("{{count}}h left", { count: reminder.hours_remaining });
    }
    return t("Due now");
  }

  const sections = [
    { title: t("Overdue"), items: reminders.filter(item => item.is_overdue) },
    { title: t("Upcoming"), items: reminders.filter(item => !item.is_overdue) },
  ].map(section => ({ ...section, items: section.items.sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline)) }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t("Reminders") }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 120, maxWidth: layout.maxWidth || 640 }]} refreshControl={<RefreshControl refreshing={isRefreshing} tintColor={colors.accent} onRefresh={onRefresh} />}>
        <View style={styles.heading}>
          <ThemedText style={AppTypography.heading}>{t("Your reminders")}</ThemedText>
          <ThemedText style={{ color: colors.muted }}>{t("Stay on top of your contributions.")}</ThemedText>
        </View>
        {!remindersLoading && !remindersError && reminders.length > 0 ? <AppCard>
          <View style={styles.row}>
            <Ionicons name={overdueCount ? "alert-circle-outline" : "calendar-outline"} size={28} color={colors.accent} />
            <ThemedText style={[AppTypography.section, styles.flex]}>{overdueCount ? t("{{count}} overdue reminder(s) need attention.", { count: overdueCount }) : t("{{count}} upcoming reminder(s).", { count: reminders.length })}</ThemedText>
          </View>
        </AppCard> : null}
        {remindersLoading ? <AppCard><ActivityIndicator color={colors.accent} /><ThemedText>{t("Loading reminder feed...")}</ThemedText></AppCard> : remindersError ? <AppCard>
          <ThemedText style={AppTypography.section}>{t("Reminders are unavailable")}</ThemedText>
          <ThemedText style={{ color: colors.muted }}>{t("Pull down to try again.")}</ThemedText>
          <AppButton secondary label={t("Try again")} onPress={() => void onRefresh()} />
        </AppCard> : reminders.length === 0 ? <AppCard>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.accent} />
          <ThemedText style={AppTypography.section}>{t("You are all caught up.")}</ThemedText>
          <ThemedText style={{ color: colors.muted }}>{t("No contribution reminders right now.")}</ThemedText>
        </AppCard> : null}
        {!remindersLoading && sections.map(section => section.items.length ? <View key={section.title} style={styles.section}>
          <View style={styles.row}><ThemedText style={[AppTypography.section, styles.flex]}>{section.title}</ThemedText><ThemedText style={{ color: colors.muted }}>{section.items.length}</ThemedText></View>
          {remindersError ? <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Showing previously loaded reminders.")}</ThemedText> : null}
          {section.items.map(reminder => <Link key={`${reminder.tontine_id}-${reminder.cycle_id}`} href={{ pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]", params: { tontineId: String(reminder.tontine_id), cycleId: String(reminder.cycle_id) } }} asChild>
            <Pressable accessibilityRole="link" accessibilityHint={t("View cycle details")} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
              <AppCard>
                <ThemedText style={AppTypography.section}>{reminder.tontine_name}</ThemedText>
                <View style={[styles.badge, { backgroundColor: reminder.is_overdue ? "#FEF3F2" : colors.track }]}><Ionicons name={reminder.is_overdue ? "alert-circle-outline" : "time-outline"} size={16} color={reminder.is_overdue ? "#B42318" : colors.accent} /><ThemedText style={[AppTypography.caption, { color: reminder.is_overdue ? "#B42318" : colors.accent }]}>{getReminderUrgencyText(reminder)}</ThemedText></View>
                <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Reminder cycle {{number}}", { number: reminder.cycle_number })}</ThemedText>
                <View style={styles.row}><Ionicons name="calendar-outline" size={18} color={colors.muted} /><ThemedText style={[styles.flex, { color: colors.muted }]}>{t("Due {{date}}", { date: formatShortDate(reminder.deadline) })}</ThemedText></View>
                <View style={styles.row}><ThemedText style={[styles.flex, { color: colors.accent, fontWeight: "700" }]}>{t("View cycle details")}</ThemedText><Ionicons name="arrow-forward" size={20} color={colors.accent} /></View>
              </AppCard>
            </Pressable>
          </Link>)}
        </View> : null)}
        <AppCard>
          <View style={styles.row}>
            <View style={styles.flex}><ThemedText style={AppTypography.section}>{t("Push notifications")}</ThemedText><ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Get contribution reminders and important Cercora updates.")}</ThemedText></View>
            <Switch accessibilityLabel={t("Push notifications")} accessibilityHint={t("Turns push notifications on or off")} disabled={pushBusy || (!nativePushSupported && !webPushSupported)} onValueChange={enabled => void (enabled ? enablePush() : disablePush())} trackColor={{ false: colors.border, true: BrandColors.blue }} thumbColor="#FFFFFF" value={pushSubscribed} />
          </View>
          {pushBusy ? <ActivityIndicator color={colors.accent} /> : <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{!nativePushSupported && !webPushSupported ? t("Notifications are unavailable on this device.") : permission === "denied" && !nativePushSupported ? t("Notifications are blocked in your browser settings.") : pushSubscribed ? t("On") : t("Off")}</ThemedText>}
          {pushError ? <ThemedText accessibilityRole="alert">{t(pushError)}</ThemedText> : null}
        </AppCard>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24, width: "100%", alignSelf: "center" },
  heading: { gap: 8 }, section: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
});
