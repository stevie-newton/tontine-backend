import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_SETTINGS_KEY = "auth.biometric.settings";
const BIOMETRIC_CREDENTIALS_KEY = "auth.biometric.credentials";
const BIOMETRIC_KEYCHAIN_SERVICE = "com.cercora.mobile.biometric";

type StoredBiometricSettings = {
  isEnabled: boolean;
};

export type BiometricCredentials = {
  phone: string;
  password: string;
};

export type BiometricStatus = {
  isAvailable: boolean;
  isEnabled: boolean;
  label: string;
};

function getDefaultBiometricLabel() {
  return Platform.OS === "ios" ? "Face ID" : "Biometric sign in";
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }
  return getDefaultBiometricLabel();
}

function getSecureStoreOptions(label: string): SecureStore.SecureStoreOptions {
  return {
    keychainService: BIOMETRIC_KEYCHAIN_SERVICE,
    requireAuthentication: true,
    authenticationPrompt: `Use ${label} to continue in Cercora.`,
  };
}

async function readStoredSettings(): Promise<StoredBiometricSettings> {
  const raw = await AsyncStorage.getItem(BIOMETRIC_SETTINGS_KEY);
  if (!raw) return { isEnabled: false };

  try {
    const parsed = JSON.parse(raw) as StoredBiometricSettings;
    return { isEnabled: !!parsed.isEnabled };
  } catch {
    return { isEnabled: false };
  }
}

async function writeStoredSettings(settings: StoredBiometricSettings) {
  await AsyncStorage.setItem(BIOMETRIC_SETTINGS_KEY, JSON.stringify(settings));
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  const [hasHardware, isEnrolled, supportedTypes, settings] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    readStoredSettings(),
  ]);

  const label = getBiometricLabel(supportedTypes);
  const isAvailable = hasHardware && isEnrolled;

  return {
    isAvailable,
    isEnabled: isAvailable && settings.isEnabled,
    label,
  };
}

export async function saveBiometricCredentials(credentials: BiometricCredentials) {
  const status = await getBiometricStatus();
  if (!status.isAvailable) {
    throw new Error("Biometric sign in is not available on this device.");
  }

  await SecureStore.setItemAsync(
    BIOMETRIC_CREDENTIALS_KEY,
    JSON.stringify(credentials),
    getSecureStoreOptions(status.label)
  );
  await writeStoredSettings({ isEnabled: true });

  return status.label;
}

export async function getBiometricCredentials() {
  const status = await getBiometricStatus();
  if (!status.isAvailable || !status.isEnabled) {
    return null;
  }

  const raw = await SecureStore.getItemAsync(
    BIOMETRIC_CREDENTIALS_KEY,
    getSecureStoreOptions(status.label)
  );
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as BiometricCredentials;
    if (!parsed.phone || !parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function disableBiometricCredentials() {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY, {
      keychainService: BIOMETRIC_KEYCHAIN_SERVICE,
    }),
    AsyncStorage.removeItem(BIOMETRIC_SETTINGS_KEY),
  ]);
}

export function getBiometricErrorMessage(error: unknown, label: string) {
  const code = (error as { code?: string } | null)?.code;

  if (code === "user_cancel" || code === "system_cancel" || code === "app_cancel") {
    return `${label} was cancelled.`;
  }
  if (code === "not_available") {
    return `${label} is not available on this device.`;
  }
  if (code === "authentication_failed") {
    return `${label} did not recognize you. Please try again.`;
  }

  const message = error instanceof Error ? error.message : null;
  return message || `Unable to use ${label} right now.`;
}
