import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useColorScheme } from "@/hooks/useColorScheme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReanimatedLogLevel } from "react-native-reanimated";
import { configureReanimatedLogger } from "react-native-reanimated";
import { enableFreeze } from "react-native-screens";

// Prevent the splash screen from auto-hiding before asset loading is complete.
enableFreeze(); // freeze inactive tabs in the tabbar, to improve benchmarking accuracy

configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false, // Reanimated runs in strict mode by default
});

export default function RootLayout() {
    const colorScheme = useColorScheme();
    console.log("starting in", __DEV__ ? "dev" : "prod");

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
                <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Examples" }} />
                    <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
