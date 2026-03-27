import { Stack } from "expo-router";
import React from "react";

import { useI18n } from "@/hooks/use-i18n";

export default function TontinesLayout() {
  const { t } = useI18n();

  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="index" options={{ title: t("Tontines") }} />
      <Stack.Screen name="create" options={{ title: t("Create tontine") }} />
      <Stack.Screen name="[tontineId]" options={{ title: t("Tontine") }} />
      <Stack.Screen name="[tontineId]/members" options={{ title: t("Members") }} />
      <Stack.Screen name="[tontineId]/invite" options={{ title: t("Invite Member") }} />
      <Stack.Screen name="[tontineId]/cycles" options={{ title: t("Cycles") }} />
      <Stack.Screen
        name="[tontineId]/cycles/[cycleId]"
        options={{ title: t("Cycle") }}
      />
      <Stack.Screen
        name="[tontineId]/cycles/[cycleId]/contribute"
        options={{ title: t("Contribute") }}
      />
      <Stack.Screen name="[tontineId]/payouts" options={{ title: t("Payouts") }} />
      <Stack.Screen name="[tontineId]/debts" options={{ title: t("Debts") }} />
      <Stack.Screen
        name="[tontineId]/transactions"
        options={{ title: t("Transactions") }}
      />
    </Stack>
  );
}
