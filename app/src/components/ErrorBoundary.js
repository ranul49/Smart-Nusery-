import React from "react";
import { ScrollView, Text } from "react-native";
import { C } from "../theme/tokens.js";

/*
 * Catches errors thrown during render (which otherwise crash the whole app
 * in a release build with no red-box) and shows the message + stack on
 * screen instead, so a launch-time crash is diagnosable without a debugger.
 */
export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Fatal render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: C.red, marginBottom: 12 }}>Something went wrong</Text>
          <Text selectable style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Text selectable style={{ fontSize: 11, color: C.inkSoft }}>{this.state.error?.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}
