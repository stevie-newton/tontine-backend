import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function PushBridge() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as { url?: unknown };
        if (typeof data?.url === "string" && data.url.startsWith("/")) {
          router.push(data.url as never);
        }
      }
    );

    return () => {
      responseSub.remove();
    };
  }, [router]);

  return null;
}
