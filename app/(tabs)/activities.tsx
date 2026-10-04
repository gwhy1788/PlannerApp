import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
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
  getTodayLogForActivity,
  getLogsForActivity,
} from '../../src/db/database';
import { Activity, Category } from '../../src/types';
import { isDueToday, calculateStreak } from '../../src/utils/streaks';
import { frequencyLabel } from '../../src/utils/dates';
import { Colors } from '../../src/constants/theme';

interface ActivityItem {
  activity: Activity;
  isCompletedToday: boolean;
  streak: number;
}

interface Section {
  category: Category;
  data: ActivityItem[];
}

export default function ActivitiesScreen() {
  const db = useSQLiteContext();
  const [sections, setSections] = useState<Section[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [activities, categories] = await Promise.all([
      getActivities(db),
      getCategories(db),
    ]);
    const catMap = new Map(categories.map(c => [c.id, c]));

    const grouped = new Map<string, { category: Category; items: ActivityItem[] }>();

    for (const activity of activities) {
      const todayLog = await getTodayLogForActivity(db, activity.id);
      const logs = await getLogsForActivity(db, activity.id, 90);
      const streak = calculateStreak(activity, logs);
      const catId = activity.categoryId;
      const cat = catMap.get(catId) ?? {
        id: catId, name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline',
      };

      if (!grouped.has(catId)) {
        grouped.set(catId, { category: cat, items: [] });
      }
      grouped.get(catId)!.items.push({
        activity,
        isCompletedToday: !!todayLog,
        streak,
      });
    }

    const result: Section[] = [];
    for (const { category, items } of grouped.values()) {
      items.sort((a, b) => a.activity.name.localeCompare(b.activity.name));
      result.push({ category, data: items });
    }
    result.sort((a, b) => a.category.name.localeCompare(b.category.name));
    setSections(result);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalCount = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activities</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/activity/new')}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.activity.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-circle-outline" size={72} color={Colors.border} />
            <Text style={styles.emptyTitle}>No activities yet</Text>
            <Text style={styles.emptySubtitle}>Start tracking your regular habits and goals</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/activity/new')}>
              <Text style={styles.emptyBtnText}>Add First Activity</Text>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: section.category.color }]} />
            <Text style={styles.sectionTitle}>{section.category.name}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const { activity, isCompletedToday, streak } = item;
          const freq = frequencyLabel(
            activity.frequencyType,
            activity.frequencyDays,
            activity.frequencyInterval,
            activity.targetDate
          );
          const dueToday = isDueToday(activity);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/activity/${activity.id}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: activity.color + '22' }]}>
                <Ionicons name={activity.icon as any} size={20} color={activity.color} />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{activity.name}</Text>
                <Text style={styles.cardFreq}>{freq}</Text>
              </View>

              <View style={styles.cardRight}>
                {streak > 1 && (
                  <Text style={styles.streakText}>🔥 {streak}</Text>
                )}
                {dueToday && (
                  <View style={[
                    styles.dueBadge,
                    isCompletedToday && styles.dueBadgeDone,
                  ]}>
                    <Ionicons
                      name={isCompletedToday ? 'checkmark' : 'ellipse'}
                      size={isCompletedToday ? 12 : 8}
                      color={isCompletedToday ? Colors.success : activity.color}
                    />
                    <Text style={[
                      styles.dueText,
                      isCompletedToday ? styles.dueTextDone : { color: activity.color },
                    ]}>
                      {isCompletedToday ? 'Done' : 'Due'}
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={14} color={Colors.border} />
              </View>
            </TouchableOpacity>
          );
        }}
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
  title: { fontSize: 26, fontWeight: '700', color: Colors.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: 16, paddingTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 12, color: Colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardFreq: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakText: { fontSize: 12, fontWeight: '600' },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.primaryLight,
  },
  dueBadgeDone: { backgroundColor: Colors.successLight },
  dueText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  dueTextDone: { color: Colors.success },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
});
