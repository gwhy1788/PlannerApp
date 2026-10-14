import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../src/db/database';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="plannerapp.db" onInit={initDatabase}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="item/new"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="item/[id]"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings/categories"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </SQLiteProvider>
  );
}
