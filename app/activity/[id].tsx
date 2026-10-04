import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getActivity,
  getCategories,
  getLogsForActivity,
  logCompletion,
  removeLog,
  getTodayLogForActivity,
  softDeleteActivity,
} from '../../src/db/database';
import { Activity, ActivityLog, Category } from '../../src/types';
import { calculateStreak } from '../../src/utils/streaks';
import { frequencyLabel, toDateString, subtractDays, formatTime } from '../../src/utils/dates';
import { Colors } from '../../src/constants/theme';

const FALLBACK_CAT: Category = {
  id: '', name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline',
};

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [category, setCategory] = useState<Category>(FALLBACK_CAT);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [todayLog, setTodayLog] = useState<ActivityLog | null>(null);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    const [act, cats] = await Promise.all([getActivity(db, id), getCategories(db)]);
    if (!act) { router.back(); return; }

    const catMap = new Map(cats.map(c => [c.id, c]));
    const actLogs = await getLogsForActivity(db, id, 90);
    const tLog = await getTodayLogForActivity(db, id);

    setActivity(act);
    setCategory(catMap.get(act.categoryId) ?? FALLBACK_CAT);
    setLogs(actLogs);
    setTodayLog(tLog);
    setStreak(calculateStreak(act, actLogs));
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async () => {
    if (!activity) return;
    if (todayLog) {
      await removeLog(db, todayLog.id);
    } else {
      await logCompletion(db, activity.id);
    }
    await load();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete "${activity?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            await softDeleteActivity(db, id);
            router.back();
          },
        },
      ]
    );
  };

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const freqLabel = frequencyLabel(activity);

  const today = toDateString(new Date());
  const last28 = Array.from({ length: 28 }, (_, i) => subtractDays(today, 27 - i));
  const logDates = new Set(logs.map(l => l.completedAt.split('T')[0]));
  const totalDone = logs.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Activity hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: activity.color + '22' }]}>
            <Ionicons name={activity.icon as any} size={36} color={activity.color} />
          </View>
          <Text style={styles.heroName}>{activity.name}</Text>
          <View style={styles.heroBadge}>
            <View style={[styles.catDot, { backgroundColor: category.color }]} />
            <Text style={styles.heroCat}>{category.name}</Text>
          </View>
          {activity.description ? (
            <Text style={styles.heroDesc}>{activity.description}</Text>
          ) : null}
        </View>

        {/* Complete today button */}
        <TouchableOpacity
          style={[
            styles.completeBtn,
            todayLog ? styles.completeBtnDone : { backgroundColor: activity.color },
          ]}
          onPress={toggle}
        >
          <Ionicons
            name={todayLog ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={22}
            color={todayLog ? Colors.success : Colors.white}
          />
          <Text style={[styles.completeBtnText, todayLog && styles.completeBtnTextDone]}>
            {todayLog ? 'Completed today — tap to undo' : 'Mark as done today'}
          </Text>
        </TouchableOpacity>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatBox label="Current streak" value={`🔥 ${streak}`} />
          <StatBox label="Total completions" value={String(totalDone)} />
          <StatBox label="Schedule" value={freqLabel} small />
        </View>

        {activity.reminderTime ? (
          <View style={styles.infoRow}>
            <Ionicons name="alarm-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>Reminder at {formatTime(activity.reminderTime)}</Text>
          </View>
        ) : null}

        {/* 28-day heatmap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 28 days</Text>
          <View style={styles.heatGrid}>
            {last28.map(date => {
              const done = logDates.has(date);
              const isToday = date === today;
              return (
                <View
                  key={date}
                  style={[
                    styles.heatCell,
                    done ? { backgroundColor: activity.color } : styles.heatCellEmpty,
                    isToday && { borderWidth: 2, borderColor: Colors.text },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Recent log */}
        {logs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent completions</Text>
            {logs.slice(0, 10).map(log => {
              const d = new Date(log.completedAt);
              const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              return (
                <View key={log.id} style={styles.logRow}>
                  <Ionicons name="checkmark-circle" size={16} color={activity.color} />
                  <Text style={styles.logDate}>{dateStr}</Text>
                  <Text style={styles.logTime}>{timeStr}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, small && styles.statValueSmall]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  scroll: { padding: 20, paddingTop: 8 },
  hero: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 24, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  heroCat: { fontSize: 14, color: Colors.textMuted },
  heroDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  completeBtnDone: { backgroundColor: Colors.successLight },
  completeBtnText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  completeBtnTextDone: { color: Colors.success },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  statValueSmall: { fontSize: 13 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  infoText: { fontSize: 13, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell: { width: 28, height: 28, borderRadius: 6 },
  heatCellEmpty: { backgroundColor: Colors.border },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logDate: { flex: 1, fontSize: 13, color: Colors.text },
  logTime: { fontSize: 12, color: Colors.textMuted },
});
