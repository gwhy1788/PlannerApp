import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getActivities, getCategories, getLogsForActivity, getAllRecentLogs } from '../../src/db/database';
import { Activity, ActivityLog, Category } from '../../src/types';
import { calculateStreak } from '../../src/utils/streaks';
import { toDateString, subtractDays } from '../../src/utils/dates';
import { Colors } from '../../src/constants/theme';

interface ActivityStat {
  activity: Activity;
  category: Category;
  streak: number;
  completions7: number;
  completions30: number;
  logs: ActivityLog[];
}

const FALLBACK_CAT: Category = {
  id: '', name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline',
};

export default function StatsScreen() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<ActivityStat[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [activities, categories] = await Promise.all([
      getActivities(db),
      getCategories(db),
    ]);
    const catMap = new Map(categories.map(c => [c.id, c]));
    const today = toDateString(new Date());
    const ago7 = subtractDays(today, 7);
    const ago30 = subtractDays(today, 30);

    let todayTotal = 0;
    let todayDone = 0;

    const result: ActivityStat[] = [];
    for (const activity of activities) {
      const logs = await getLogsForActivity(db, activity.id, 90);
      const streak = calculateStreak(activity, logs);
      const completions7 = logs.filter(l => l.completedAt.split('T')[0] >= ago7).length;
      const completions30 = logs.filter(l => l.completedAt.split('T')[0] >= ago30).length;
      const doneToday = logs.some(l => l.completedAt.startsWith(today));

      todayTotal++;
      if (doneToday) todayDone++;

      result.push({
        activity,
        category: catMap.get(activity.categoryId) ?? FALLBACK_CAT,
        streak,
        completions7,
        completions30,
        logs,
      });
    }

    result.sort((a, b) => b.streak - a.streak);
    setStats(result);
    setTotalToday(todayTotal);
    setCompletedToday(todayDone);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const overallRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const bestStreak = stats.length > 0 ? Math.max(...stats.map(s => s.streak)) : 0;
  const totalCompletions30 = stats.reduce((n, s) => n + s.completions30, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryValue}>{overallRate}%</Text>
            <Text style={styles.summaryLabel}>Today</Text>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryValue}>🔥 {bestStreak}</Text>
            <Text style={styles.summaryLabel}>Best streak</Text>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryValue}>{totalCompletions30}</Text>
            <Text style={styles.summaryLabel}>This month</Text>
          </View>
        </View>

        {/* Activity breakdown */}
        {stats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Breakdown</Text>
            {stats.map(s => (
              <ActivityStatCard key={s.activity.id} stat={s} />
            ))}
          </View>
        )}

        {stats.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={72} color={Colors.border} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>Complete activities to see your stats</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityStatCard({ stat }: { stat: ActivityStat }) {
  const { activity, category, streak, completions7, completions30, logs } = stat;
  const today = toDateString(new Date());
  const last14 = Array.from({ length: 14 }, (_, i) => subtractDays(today, 13 - i));
  const logDates = new Set(logs.map(l => l.completedAt.split('T')[0]));

  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.iconWrap, { backgroundColor: activity.color + '22' }]}>
          <Ionicons name={activity.icon as any} size={18} color={activity.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statName} numberOfLines={1}>{activity.name}</Text>
          <Text style={styles.statCat}>{category.name}</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakChip}>
            <Text style={styles.streakChipText}>🔥 {streak}</Text>
          </View>
        )}
      </View>

      {/* Mini heatmap - last 14 days */}
      <View style={styles.heatmapRow}>
        {last14.map(date => {
          const done = logDates.has(date);
          const isToday = date === today;
          return (
            <View
              key={date}
              style={[
                styles.heatCell,
                done ? { backgroundColor: activity.color } : styles.heatCellEmpty,
                isToday && styles.heatCellToday,
              ]}
            />
          );
        })}
      </View>
      <View style={styles.statFooter}>
        <Text style={styles.statMeta}>7d: {completions7} completions</Text>
        <Text style={styles.statMeta}>30d: {completions30} completions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text },
  scroll: { padding: 16, paddingTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  statCat: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  streakChip: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakChipText: { fontSize: 12, fontWeight: '600' },
  heatmapRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  heatCell: { flex: 1, height: 20, borderRadius: 4 },
  heatCellEmpty: { backgroundColor: Colors.border },
  heatCellToday: { borderWidth: 2, borderColor: Colors.text },
  statFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  statMeta: { fontSize: 12, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted },
});
