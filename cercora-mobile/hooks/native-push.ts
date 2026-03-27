import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/hooks/api-client";

const STORAGE_KEY = "push.native.token";

export const NATIVE_PUSH_SUPPORTED = Platform.OS === "android" || Platform.OS === "ios";

export type NativePushStatus = {
  subscribed: boolean;
  devices: number;
};

export type NativePushEnableResult = {
  subscribed: boolean;
  token?: string;
  message?: string;
};

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2ECFE3",
  });
}

function getProjectId() {
  const expoConfig = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId ?? expoConfig?.eas?.projectId ?? null;
}

export async function getNativePushStatus(): Promise<NativePushStatus> {
  if (!NATIVE_PUSH_SUPPORTED) {
    return { subscribed: false, devices: 0 };
  }

  const response = await api.get<NativePushStatus>("/push/mobile/me");
  return response.data;
}

export async function enableNativePush(): Promise<NativePushEnableResult> {
  if (!NATIVE_PUSH_SUPPORTED) {
    return { subscribed: false, message: "Native push is not supported on this platform." };
  }

  if (!Device.isDevice) {
    return { subscribed: false, message: "Native push requires a physical device." };
  }

  await ensureAndroidChannel();

  let permission = await Notifications.getPermissionsAsync();
  let finalStatus = permission.status;
  if (finalStatus !== "granted") {
    permission = await Notifications.requestPermissionsAsync();
    finalStatus = permission.status;
  }

  if (finalStatus !== "granted") {
    return { subscribed: false, message: "Notification permission not granted." };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return { subscribed: false, message: "Missing EAS project ID for push registration." };
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.post("/push/mobile/subscribe", {
    expo_push_token: token,
    platform: Platform.OS,
    device_name: Device.modelName ?? null,
    app_version: Constants.expoConfig?.version ?? null,
  });
  await AsyncStorage.setItem(STORAGE_KEY, token);

  return { subscribed: true, token };
}

export async function disableNativePush() {
  const token = await AsyncStorage.getItem(STORAGE_KEY);
  if (token) {
    await api.post("/push/mobile/unsubscribe", { expo_push_token: token });
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return { subscribed: false };
}
