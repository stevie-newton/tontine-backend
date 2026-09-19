import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { api } from "@/hooks/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";

type Report = {
  id: number;
  requester_name: string | null;
  requester_phone: string | null;
  message: string;
  status: string;
  created_at: string;
  tontine_id: number | null;
};
type ReportPage = { items: Report[]; next_before_id: number | null };
type Filter = "open" | "resolved" | "all";

export function AdminReports() {
  const { user, accessToken } = useAuth();
  const { t, locale } = useI18n();
  const colors = useSurfaceColors();
  const [filter, setFilter] = useState<Filter>("open");
  const [reports, setReports] = useState<Report[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async (before: number | null = null) => {
    if (!user?.is_global_admin || !accessToken) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const version = ++generation.current;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      const { data } = await api.get<ReportPage>("/support/tickets", {
        params: { status: filter, limit: 20, ...(before ? { before_id: before } : {}) },
        signal: request.signal,
      });
      if (version !== generation.current) return;
      setReports(previous => before ? [...previous, ...data.items.filter(item => !previous.some(old => old.id === item.id))] : data.items);
      setNext(data.next_before_id);
    } catch {
      if (version === generation.current) setError(true);
    } finally {
      if (version === generation.current) { locked.current = false; setBusy(false); }
    }
  }, [accessToken, filter, user?.is_global_admin]);

  useFocusEffect(useCallback(() => {
    setReports([]);
    setNext(null);
    setExpanded(null);
    setNotice(null);
    void load();
    return () => { generation.current++; controller.current?.abort(); locked.current = false; };
  }, [load]));

  async function update(report: Report) {
    if (locked.current || !user?.is_global_admin || !accessToken) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    setNotice(null);
    const version = generation.current;
    const status = report.status === "resolved" ? "open" : "resolved";
    try {
      await api.patch(`/support/tickets/${report.id}`, { status });
      if (version !== generation.current) return;
      setNotice(status === "resolved" ? "Report marked as resolved." : "Report reopened.");
      await load();
    } catch {
      if (version === generation.current) setError(true);
    } finally {
      if (version === generation.current) { locked.current = false; setBusy(false); }
    }
  }

  if (!user?.is_global_admin || !accessToken) return null;

  return (
    <AppCard>
      <ThemedText style={AppTypography.section}>{t("Reports")}</ThemedText>
      <ThemedText style={{ color: colors.muted }}>{t("Read tester feedback and track what needs attention.")}</ThemedText>
      <View style={styles.filters} accessibilityRole="radiogroup">
        {(["open", "resolved", "all"] as const).map(value => (
          <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: filter === value, disabled: busy }} disabled={busy} onPress={() => setFilter(value)} style={[styles.filter, { backgroundColor: filter === value ? colors.track : colors.surface, borderColor: colors.border }]}>
            <ThemedText style={{ color: colors.accent }}>{value === "open" ? t("Open reports") : value === "resolved" ? t("Resolved reports") : t("All reports")}</ThemedText>
          </Pressable>
        ))}
      </View>
      <AppButton secondary label={t("Refresh reports")} disabled={busy} onPress={() => { setNotice(null); void load(); }} />
      {notice ? <ThemedText accessibilityLiveRegion="polite">{t(notice)}</ThemedText> : null}
      {error ? <ThemedText accessibilityRole="alert">{t("Unable to update reports. Refresh to check their latest status.")}</ThemedText> : null}
      {!busy && !error && reports.length === 0 ? <ThemedText style={{ color: colors.muted }}>{t("No reports in this category.")}</ThemedText> : null}
      {reports.map(report => (
        <View key={report.id} style={[styles.report, { borderColor: colors.border }]}>
          <ThemedText type="defaultSemiBold">{t("Report #{{id}}", { id: report.id })}</ThemedText>
          <ThemedText>{report.requester_name || t("Unknown sender")}</ThemedText>
          {report.requester_phone ? <ThemedText selectable>{report.requester_phone}</ThemedText> : null}
          <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{new Date(report.created_at).toLocaleString(locale)}</ThemedText>
          <ThemedText type="defaultSemiBold">{report.status === "resolved" ? t("Resolved") : report.status === "open" ? t("Open") : report.status}</ThemedText>
          <ThemedText selectable numberOfLines={expanded === report.id ? undefined : 3}>{report.message}</ThemedText>
          <AppButton secondary label={expanded === report.id ? t("Show less") : t("Read full report")} onPress={() => setExpanded(expanded === report.id ? null : report.id)} />
          <AppButton label={report.status === "resolved" ? t("Reopen report") : t("Mark as resolved")} disabled={busy} onPress={() => void update(report)} />
        </View>
      ))}
      {busy ? <ActivityIndicator accessibilityLabel={t("Loading reports...")} color={colors.accent} /> : null}
      {next !== null ? <AppButton secondary label={t("Load older reports")} disabled={busy} onPress={() => { if (!locked.current) void load(next); }} /> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { minHeight: 44, justifyContent: "center", padding: 10, borderRadius: 12, borderWidth: 1 },
  report: { borderTopWidth: 1, paddingTop: 16, gap: 10 },
});
