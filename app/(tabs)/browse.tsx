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
import { getItems, getCategories } from '../../src/db/database';
import { ScheduleItem, Category, ItemType } from '../../src/types';
import { ITEM_TYPE_CONFIG, ITEM_TYPE_ORDER } from '../../src/constants/itemTypes';
import { frequencyLabel } from '../../src/utils/dates';
import { Colors } from '../../src/constants/theme';

interface BrowseSection {
  itemType: ItemType;
  data: ScheduleItem[];
}

const FALLBACK_CATEGORY: Category = {
  id: '', name: 'Uncategorized', color: Colors.textMuted, icon: 'folder-outline', parentId: '',
};

export default function BrowseScreen() {
  const db = useSQLiteContext();
  const [sections, setSections] = useState<BrowseSection[]>([]);
  const [catMap, setCatMap] = useState<Map<string, Category>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [allItems, categories] = await Promise.all([
      getItems(db),
      getCategories(db),
    ]);
    const map = new Map(categories.map(c => [c.id, c]));
    setCatMap(map);

    const grouped = new Map<ItemType, ScheduleItem[]>();
    for (const type of ITEM_TYPE_ORDER) {
      grouped.set(type, []);
    }
    for (const item of allItems) {
      const bucket = grouped.get(item.itemType);
      if (bucket) bucket.push(item);
    }

    const result: BrowseSection[] = ITEM_TYPE_ORDER.map(type => ({
      itemType: type,
      data: grouped.get(type) ?? [],
    }));
    setSections(result);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/item/new')}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderSectionHeader={({ section }) => {
          const config = ITEM_TYPE_CONFIG[section.itemType];
          return (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: config.color + '22' }]}>
                <Ionicons name={config.icon as any} size={16} color={config.color} />
              </View>
              <Text style={styles.sectionTitle}>{config.pluralLabel}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          );
        }}
        renderSectionFooter={({ section }) => {
          if (section.data.length > 0) return null;
          const config = ITEM_TYPE_CONFIG[section.itemType];
          return (
            <TouchableOpacity
              style={styles.emptySection}
              onPress={() => router.push({ pathname: '/item/new', params: { type: section.itemType } })}
            >
              <Ionicons name="add-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.emptySectionText}>Add {config.label.toLowerCase()}</Text>
            </TouchableOpacity>
          );
        }}
        renderItem={({ item }) => {
          const config = ITEM_TYPE_CONFIG[item.itemType];
          const accentColor = item.color || config.color;
          const cat = catMap.get(item.categoryId) ?? FALLBACK_CATEGORY;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/item/${item.id}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
                <Ionicons name={(item.icon || config.icon) as any} size={20} color={accentColor} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {cat.id ? cat.name + ' · ' : ''}{frequencyLabel(item)}
                </Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  list: { paddingBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionCount: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  emptySection: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  emptySectionText: { fontSize: 13, color: Colors.textMuted },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
