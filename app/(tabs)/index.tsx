import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getActivities,
  getCategories,
  logCompletion,
  removeLog,
  getTodayLogForActivity,
  getLogsForActivity,
} from '../../src/db/database';
import { Activity, ActivityLog, Category } from '../../src/types';
import { isDueToday, calculateStreak } from '../../src/utils/streaks';
import { Colors } from '../../src/constants/theme';

interface TodayItem {
  activity: Activity;
  category: Category;
  isCompleted: boolean;
  todayLog: ActivityLog | null;
  streak: number;
}

const FALLBACK_CATEGORY: Category = {
  id: '', name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline',
};

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<TodayItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [activities, categories] = await Promise.all([
      getActivities(db),
      getCategories(db),
    ]);
    const catMap = new Map(categories.map(c => [c.id, c]));

    const results: TodayItem[] = [];
    for (const activity of activities) {
      const logs = await getLogsForActivity(db, activity.id, 90);
      const lastLog = logs[0];
      const lastDate = lastLog?.completedAt.split('T')[0];
      if (!isDueToday(activity, lastDate)) continue;

      const todayLog = await getTodayLogForActivity(db, activity.id);
      const streak = calculateStreak(activity, logs);
      results.push({
        activity,
        category: catMap.get(activity.categoryId) ?? FALLBACK_CATEGORY,
        isCompleted: !!todayLog,
        todayLog,
        streak,
      });
    }

    results.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.activity.name.localeCompare(b.activity.name);
    });
    setItems(results);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = async (item: TodayItem) => {
    if (item.isCompleted && item.todayLog) {
      await removeLog(db, item.todayLog.id);
    } else {
      await logCompletion(db, item.activity.id);
    }
    await load();
  };

  const completed = items.filter(i => i.isCompleted).length;
  const total = items.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dayName}>{dayName}</Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/activity/new')}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {total > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{completed} of {total} done</Text>
            <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={i => i.activity.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={72} color={Colors.border} />
            <Text style={styles.emptyTitle}>Nothing scheduled today</Text>
            <Text style={styles.emptySubtitle}>Tap + to add an activity</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/activity/new')}>
              <Text style={styles.emptyBtnText}>Add Activity</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.isCompleted && styles.cardDone]}
            onPress={() => router.push(`/activity/${item.activity.id}`)}
            activeOpacity={0.75}
          >
            <TouchableOpacity
              style={[
                styles.checkbox,
                item.isCompleted && { backgroundColor: item.category.color, borderColor: item.category.color },
              ]}
              onPress={() => toggle(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {item.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
            </TouchableOpacity>

            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, item.isCompleted && styles.cardTitleDone]} numberOfLines={1}>
                {item.activity.name}
              </Text>
              <View style={styles.cardMeta}>
                <View style={[styles.catDot, { backgroundColor: item.category.color }]} />
                <Text style={styles.catName}>{item.category.name}</Text>
                {item.streak > 1 && (
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakText}>🔥 {item.streak}</Text>
                  </View>
                )}
              </View>
            </View>

            <Ionicons name="chevron-forward" size={16} color={Colors.border} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  dayName: { fontSize: 26, fontWeight: '700', color: Colors.text },
  dateLabel: { fontSize: 14, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: Colors.textMuted },
  progressPct: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  list: { padding: 16, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardDone: { opacity: 0.65 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 12, color: Colors.textMuted },
  streakBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  streakText: { fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
});
