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
  getItem,
  getCategories,
  getLogsForItem,
  logCompletion,
  removeLog,
  getLogForItemOnDate,
  softDeleteItem,
} from '../../src/db/database';
import { ScheduleItem, ItemLog, Category } from '../../src/types';
import { getItemTypeConfig } from '../../src/constants/itemTypes';
import { calculateStreak } from '../../src/utils/streaks';
import { frequencyLabel, toDateString, subtractDays, formatTime } from '../../src/utils/dates';
import { Colors } from '../../src/constants/theme';

const FALLBACK_CAT: Category = {
  id: '', name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline', parentId: '',
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();

  const [item, setItem] = useState<ScheduleItem | null>(null);
  const [category, setCategory] = useState<Category>(FALLBACK_CAT);
  const [subcategory, setSubcategory] = useState<Category | null>(null);
  const [logs, setLogs] = useState<ItemLog[]>([]);
  const [todayLog, setTodayLog] = useState<ItemLog | null>(null);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    const [loaded, cats] = await Promise.all([getItem(db, id), getCategories(db)]);
    if (!loaded) { router.back(); return; }

    const catMap = new Map(cats.map(c => [c.id, c]));
    const itemLogs = await getLogsForItem(db, id, 90);
    const today = toDateString(new Date());
    const tLog = await getLogForItemOnDate(db, id, today);

    setItem(loaded);
    setCategory(catMap.get(loaded.categoryId) ?? FALLBACK_CAT);
    setSubcategory(loaded.subcategoryId ? (catMap.get(loaded.subcategoryId) ?? null) : null);
    setLogs(itemLogs);
    setTodayLog(tLog);
    setStreak(calculateStreak(loaded, itemLogs));
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async () => {
    if (!item) return;
    if (todayLog) {
      await removeLog(db, todayLog.id);
    } else {
      await logCompletion(db, item.id);
    }
    await load();
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${item ? getItemTypeConfig(item.itemType).label : 'Item'}`,
      `Are you sure you want to delete "${item?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            await softDeleteItem(db, id);
            router.back();
          },
        },
      ]
    );
  };

  if (!item) return null;

  const typeConfig = getItemTypeConfig(item.itemType);
  const accentColor = item.color || typeConfig.color;
  const today = toDateString(new Date());
  const last14 = Array.from({ length: 14 }, (_, i) => subtractDays(today, 13 - i));
  const logDates = new Set(logs.map(l => l.completedAt.split('T')[0]));
  const isCompletedToday = !!todayLog;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/item/new', params: { id: item.id, type: item.itemType } })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBtn}
        >
          <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={22} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name={(item.icon || typeConfig.icon) as any} size={40} color={accentColor} />
          </View>
          <Text style={styles.heroName}>{item.name}</Text>
          <View style={styles.typeBadge}>
            <Ionicons name={typeConfig.icon as any} size={12} color={accentColor} />
            <Text style={[styles.typeBadgeText, { color: accentColor }]}>{typeConfig.label}</Text>
          </View>
          {item.description ? <Text style={styles.heroDesc}>{item.description}</Text> : null}
        </View>

        {/* ── Complete Today button ── */}
        {item.isRecurring && (
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              isCompletedToday
                ? { backgroundColor: Colors.successLight, borderColor: Colors.success }
                : { backgroundColor: accentColor + '18', borderColor: accentColor },
            ]}
            onPress={toggle}
          >
            <Ionicons
              name={isCompletedToday ? 'checkmark-circle' : 'radio-button-off-outline'}
              size={22}
              color={isCompletedToday ? Colors.success : accentColor}
            />
            <Text style={[styles.toggleText, { color: isCompletedToday ? Colors.success : accentColor }]}>
              {isCompletedToday ? 'Completed today' : 'Mark as done today'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>🔥 {streak}</Text>
            <Text style={styles.statLbl}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{logs.filter(l => l.completedAt.split('T')[0] >= subtractDays(today, 7)).length}</Text>
            <Text style={styles.statLbl}>Last 7 days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{logs.filter(l => l.completedAt.split('T')[0] >= subtractDays(today, 30)).length}</Text>
            <Text style={styles.statLbl}>Last 30 days</Text>
          </View>
        </View>

        {/* ── Mini heatmap ── */}
        {item.isRecurring && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 14 days</Text>
            <View style={styles.heatmapRow}>
              {last14.map(date => {
                const done = logDates.has(date);
                const isToday = date === today;
                return (
                  <View
                    key={date}
                    style={[
                      styles.heatCell,
                      done ? { backgroundColor: accentColor } : styles.heatCellEmpty,
                      isToday && { borderWidth: 2, borderColor: accentColor },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailCard}>
            <DetailRow icon="refresh-outline" label="Schedule" value={frequencyLabel(item)} />
            {category.id && (
              <DetailRow
                icon="folder-outline"
                label="Category"
                value={subcategory ? `${category.name}  ›  ${subcategory.name}` : category.name}
                color={category.color}
              />
            )}
            {item.reminderTime && <DetailRow icon="alarm-outline" label="Reminder" value={formatTime(item.reminderTime)} />}
            {item.targetDate && <DetailRow icon="calendar-outline" label="Target date" value={item.targetDate} />}
          </View>
        </View>

        {/* ── Recent activity ── */}
        {logs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent completions</Text>
            {logs.slice(0, 10).map(log => (
              <View key={log.id} style={styles.logRow}>
                <View style={[styles.logDot, { backgroundColor: accentColor }]} />
                <Text style={styles.logDate}>
                  {new Date(log.completedAt).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })}
                </Text>
                {log.note ? <Text style={styles.logNote} numberOfLines={1}>{log.note}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, color }: {
  icon: string; label: string; value: string; color?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color={color ?? Colors.textMuted} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color ? { color } : {}]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  headerBtn: { padding: 2 },
  scroll: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  heroIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 24, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  heroDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
  toggleText: { fontSize: 16, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  statVal: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statLbl: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },

  heatmapRow: { flexDirection: 'row', gap: 4 },
  heatCell: { flex: 1, height: 24, borderRadius: 4 },
  heatCellEmpty: { backgroundColor: Colors.border },

  detailCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: 14, color: Colors.textMuted, width: 90 },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logDate: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  logNote: { flex: 1, fontSize: 13, color: Colors.textMuted },
});
