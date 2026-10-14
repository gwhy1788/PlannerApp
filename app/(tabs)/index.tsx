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
  getItems,
  getCategories,
  logCompletion,
  removeLog,
  getLogForItemOnDate,
  getLogsForItem,
} from '../../src/db/database';
import { ScheduleItem, ItemLog, Category } from '../../src/types';
import { ITEM_TYPE_CONFIG } from '../../src/constants/itemTypes';
import { isDueOnDate, calculateStreak } from '../../src/utils/streaks';
import { toDateString, addDays, subtractDays, DAY_FULL, MONTH_SHORT } from '../../src/utils/dates';
import { Colors } from '../../src/constants/theme';

interface DayItem {
  item: ScheduleItem;
  category: Category | null;
  isCompleted: boolean;
  log: ItemLog | null;
  streak: number;
}

const FALLBACK_CATEGORY: Category = {
  id: '', name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline', parentId: '',
};

function formatDayHeader(dateStr: string): { dayName: string; dateLabel: string; isToday: boolean } {
  const today = toDateString(new Date());
  const yesterday = subtractDays(today, 1);
  const tomorrow = addDays(today, 1);

  const d = new Date(dateStr + 'T00:00:00');
  const dayName = dateStr === today ? 'Today'
                : dateStr === yesterday ? 'Yesterday'
                : dateStr === tomorrow ? 'Tomorrow'
                : DAY_FULL[d.getDay()];
  const dateLabel = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return { dayName, dateLabel, isToday: dateStr === today };
}

export default function DayScreen() {
  const db = useSQLiteContext();
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (dateStr: string) => {
    const [allItems, categories] = await Promise.all([
      getItems(db),
      getCategories(db),
    ]);
    const catMap = new Map(categories.map(c => [c.id, c]));

    const results: DayItem[] = [];
    for (const item of allItems) {
      if (!isDueOnDate(item, dateStr)) continue;

      const [log, logs] = await Promise.all([
        getLogForItemOnDate(db, item.id, dateStr),
        getLogsForItem(db, item.id, 90),
      ]);
      const streak = calculateStreak(item, logs);
      results.push({
        item,
        category: catMap.get(item.categoryId) ?? FALLBACK_CATEGORY,
        isCompleted: !!log,
        log,
        streak,
      });
    }

    results.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.item.name.localeCompare(b.item.name);
    });
    setDayItems(results);
  }, [db]);

  useFocusEffect(useCallback(() => { load(selectedDate); }, [load, selectedDate]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load(selectedDate);
    setRefreshing(false);
  };

  const navigate = (direction: -1 | 1) => {
    const next = direction === -1 ? subtractDays(selectedDate, 1) : addDays(selectedDate, 1);
    setSelectedDate(next);
  };

  const toggle = async (di: DayItem) => {
    if (di.isCompleted && di.log) {
      await removeLog(db, di.log.id);
    } else {
      await logCompletion(db, di.item.id);
    }
    await load(selectedDate);
  };

  const completed = dayItems.filter(i => i.isCompleted).length;
  const total = dayItems.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const { dayName, dateLabel, isToday } = formatDayHeader(selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigate(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.dayName}>{dayName}</Text>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => navigate(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/item/new')}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Today shortcut */}
      {!isToday && (
        <TouchableOpacity style={styles.todayPill} onPress={() => setSelectedDate(toDateString(new Date()))}>
          <Text style={styles.todayPillText}>Jump to Today</Text>
        </TouchableOpacity>
      )}

      {/* Progress bar */}
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
        data={dayItems}
        keyExtractor={i => i.item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={72} color={Colors.border} />
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptySubtitle}>Tap + to add an item</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/item/new')}>
              <Text style={styles.emptyBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: di }) => {
          const typeConfig = ITEM_TYPE_CONFIG[di.item.itemType];
          const accentColor = di.item.color || typeConfig.color;
          const cat = di.category;
          return (
            <TouchableOpacity
              style={[styles.card, di.isCompleted && styles.cardDone]}
              onPress={() => router.push(`/item/${di.item.id}`)}
              activeOpacity={0.75}
            >
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  di.isCompleted && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
                onPress={() => toggle(di)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {di.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>

              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, di.isCompleted && styles.cardTitleDone]} numberOfLines={1}>
                  {di.item.name}
                </Text>
                <View style={styles.cardMeta}>
                  <View style={[styles.typePill, { backgroundColor: accentColor + '22' }]}>
                    <Ionicons name={typeConfig.icon as any} size={10} color={accentColor} />
                    <Text style={[styles.typeLabel, { color: accentColor }]}>{typeConfig.label}</Text>
                  </View>
                  {cat && cat.id !== '' && (
                    <>
                      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                      <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                    </>
                  )}
                  {di.streak > 1 && (
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakText}>🔥 {di.streak}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color={Colors.border} />
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
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dayName: { fontSize: 22, fontWeight: '700', color: Colors.text },
  dateLabel: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },
  todayPill: {
    alignSelf: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 8,
  },
  todayPillText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  progressWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: Colors.textMuted },
  progressPct: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  list: { padding: 16, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardDone: { opacity: 0.65 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, flexWrap: 'wrap' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeLabel: { fontSize: 10, fontWeight: '600' },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catName: { fontSize: 12, color: Colors.textMuted, maxWidth: 100 },
  streakBadge: { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  streakText: { fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted },
  emptyBtn: {
    marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
});
