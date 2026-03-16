import { Link, Stack } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";

export default function TontinesLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen
        name="index"
        options={{
          title: "Tontines",
          headerRight: () => (
            <Link href="/(tabs)/tontines/create" asChild>
              <Pressable style={styles.headerButton}>
                <ThemedText type="link">New</ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <Stack.Screen name="create" options={{ title: "New tontine" }} />
      <Stack.Screen name="[tontineId]" options={{ title: "Tontine" }} />
      <Stack.Screen name="[tontineId]/members" options={{ title: "Members" }} />
      <Stack.Screen name="[tontineId]/invite" options={{ title: "Invite" }} />
      <Stack.Screen name="[tontineId]/cycles" options={{ title: "Cycles" }} />
      <Stack.Screen
        name="[tontineId]/cycles/[cycleId]"
        options={{ title: "Cycle" }}
      />
      <Stack.Screen
        name="[tontineId]/cycles/[cycleId]/contribute"
        options={{ title: "Contribute" }}
      />
      <Stack.Screen name="[tontineId]/payouts" options={{ title: "Payouts" }} />
      <Stack.Screen name="[tontineId]/debts" options={{ title: "Debts" }} />
      <Stack.Screen
        name="[tontineId]/transactions"
        options={{ title: "Transactions" }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
