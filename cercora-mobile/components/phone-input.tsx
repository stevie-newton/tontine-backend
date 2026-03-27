import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandColors, BrandShadow } from "@/constants/brand";
import {
  buildPhoneValue,
  getDefaultPhoneCountry,
  normalizeLocalPhoneNumber,
  parsePhoneValue,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from "@/constants/phone-countries";
import { useI18n } from "@/hooks/use-i18n";

type PhoneInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  placeholderTextColor?: string;
  editable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function PhoneInput({
  value,
  onChangeText,
  placeholder,
  helperText,
  placeholderTextColor = "#98A2B3",
  editable = true,
  containerStyle,
  inputStyle,
}: PhoneInputProps) {
  const { locale, t } = useI18n();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const parsedValue = useMemo(() => parsePhoneValue(value), [value]);
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(
    parsedValue.country ?? getDefaultPhoneCountry()
  );
  const [localNumber, setLocalNumber] = useState(parsedValue.localNumber);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return PHONE_COUNTRIES;
    }

    return PHONE_COUNTRIES.filter((country) => country.searchValue.includes(query));
  }, [searchQuery]);

  useEffect(() => {
    setSelectedCountry(parsedValue.country);
    setLocalNumber(parsedValue.localNumber);
  }, [parsedValue.country, parsedValue.localNumber]);

  function handleLocalNumberChange(nextValue: string) {
    const trimmed = nextValue.trim();

    if (trimmed.startsWith("+")) {
      const parsed = parsePhoneValue(trimmed);
      setSelectedCountry(parsed.country);
      setLocalNumber(parsed.localNumber);
      onChangeText(buildPhoneValue(parsed.country, parsed.localNumber));
      return;
    }

    const normalized = normalizeLocalPhoneNumber(nextValue);
    setLocalNumber(normalized);
    onChangeText(buildPhoneValue(selectedCountry, normalized));
  }

  function handleCountrySelect(country: PhoneCountry) {
    setSelectedCountry(country);
    setSearchQuery("");
    setIsPickerOpen(false);
    onChangeText(buildPhoneValue(country, localNumber));
  }

  return (
    <View style={containerStyle}>
      <View style={[styles.field, !editable ? styles.fieldDisabled : null]}>
        <Pressable
          style={({ pressed }) => [
            styles.countryButton,
            pressed && editable ? styles.countryButtonPressed : null,
          ]}
          disabled={!editable}
          onPress={() => setIsPickerOpen(true)}
        >
          <ThemedText style={styles.countryDialCode}>{selectedCountry.dialCode}</ThemedText>
          <ThemedText style={styles.countryCode}>{selectedCountry.code}</ThemedText>
        </Pressable>

        <View style={styles.divider} />

        <TextInput
          value={localNumber}
          onChangeText={handleLocalNumberChange}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          keyboardType="phone-pad"
          autoCapitalize="none"
          editable={editable}
          style={[styles.input, inputStyle]}
        />
      </View>
      {helperText ? <ThemedText style={styles.helperText}>{helperText}</ThemedText> : null}

      <Modal
        visible={isPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPickerOpen(false)} />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{t("Choose country code")}</ThemedText>
              <Pressable onPress={() => setIsPickerOpen(false)}>
                <ThemedText style={styles.modalClose}>{t("Dismiss")}</ThemedText>
              </Pressable>
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("Search countries or code")}
              placeholderTextColor="#98A2B3"
              autoCapitalize="words"
              style={styles.searchInput}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredCountries.map((country) => {
                const isActive =
                  country.code === selectedCountry.code && country.dialCode === selectedCountry.dialCode;

                return (
                  <Pressable
                    key={`${country.code}-${country.dialCode}`}
                    style={({ pressed }) => [
                      styles.countryOption,
                      isActive ? styles.countryOptionActive : null,
                      pressed ? styles.countryOptionPressed : null,
                    ]}
                    onPress={() => handleCountrySelect(country)}
                  >
                    <View style={styles.countryOptionCopy}>
                      <ThemedText
                        style={[
                          styles.countryOptionName,
                          isActive ? styles.countryOptionNameActive : null,
                        ]}
                      >
                        {locale === "fr" ? country.nameFr : country.name}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.countryOptionMeta,
                          isActive ? styles.countryOptionMetaActive : null,
                        ]}
                      >
                        {country.code}
                      </ThemedText>
                    </View>

                    <ThemedText
                      style={[
                        styles.countryOptionDialCode,
                        isActive ? styles.countryOptionDialCodeActive : null,
                      ]}
                    >
                      {country.dialCode}
                    </ThemedText>
                  </Pressable>
                );
              })}

              {!filteredCountries.length ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateTitle}>
                    {t("No matching country")}
                  </ThemedText>
                  <ThemedText style={styles.emptyStateText}>
                    {t("Try a country name, dial code, or ISO code.")}
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
  },
  fieldDisabled: {
    opacity: 0.7,
  },
  countryButton: {
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 2,
    backgroundColor: "rgba(247,249,255,0.96)",
  },
  countryButtonPressed: {
    opacity: 0.85,
  },
  countryDialCode: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  countryCode: {
    color: BrandColors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: BrandColors.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: BrandColors.ink,
    fontSize: 15,
  },
  helperText: {
    marginTop: 4,
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(9, 16, 34, 0.34)",
  },
  modalCard: {
    maxHeight: "72%",
    borderRadius: 28,
    backgroundColor: BrandColors.surfaceStrong,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 14,
    ...BrandShadow,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: {
    color: BrandColors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  modalClose: {
    color: BrandColors.blue,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    borderRadius: 18,
    backgroundColor: "rgba(247,249,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: BrandColors.ink,
    fontSize: 15,
  },
  countryOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  countryOptionActive: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "rgba(42,109,230,0.18)",
  },
  countryOptionPressed: {
    opacity: 0.88,
  },
  countryOptionCopy: {
    flex: 1,
    gap: 2,
  },
  countryOptionName: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  countryOptionNameActive: {
    color: BrandColors.blueDeep,
  },
  countryOptionMeta: {
    color: BrandColors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  countryOptionMetaActive: {
    color: BrandColors.blue,
  },
  countryOptionDialCode: {
    color: BrandColors.inkSoft,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  countryOptionDialCodeActive: {
    color: BrandColors.blueDeep,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 4,
  },
  emptyStateTitle: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  emptyStateText: {
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
