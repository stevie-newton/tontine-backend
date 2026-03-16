import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("AppErrorBoundary caught an error", error);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ThemedView style={styles.container} lightColor="#F4F7FB">
          <View style={styles.card}>
            <ThemedText style={styles.eyebrow}>Something went wrong</ThemedText>
            <ThemedText type="title">The app hit an unexpected error</ThemedText>
            <ThemedText style={styles.supportText}>
              Try reloading this view. If the problem keeps happening, sign in again or retry the action a little later.
            </ThemedText>
            <Pressable style={styles.button} onPress={this.reset}>
              <ThemedText style={styles.buttonText}>Try again</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF5",
    padding: 18,
    gap: 12,
  },
  eyebrow: {
    color: "#B42318",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  supportText: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#0A2A66",
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
});
