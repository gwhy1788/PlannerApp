import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCategories, upsertCategory, deleteCategory } from '../../src/db/database';
import { Category } from '../../src/types';
import { Colors, CATEGORY_COLORS } from '../../src/constants/theme';

interface CatSection {
  parent: Category;
  data: Category[];
}

function makeId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_ICON = 'folder-outline';

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const [sections, setSections] = useState<CatSection[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingParentId, setEditingParentId] = useState('');
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(Colors.primary);

  const load = useCallback(async () => {
    const cats = await getCategories(db);
    const tops = cats.filter(c => c.parentId === '');
    const result: CatSection[] = tops.map(top => ({
      parent: top,
      data: cats.filter(c => c.parentId === top.id),
    }));
    setSections(result);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = (parentId: string) => {
    setEditingCat(null);
    setEditingParentId(parentId);
    setCatName('');
    setCatColor(parentId === ''
      ? Colors.primary
      : sections.find(s => s.parent.id === parentId)?.parent.color ?? Colors.primary);
    setModalVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setEditingParentId(cat.parentId);
    setCatName(cat.name);
    setCatColor(cat.color);
    setModalVisible(true);
  };

  const save = async () => {
    if (!catName.trim()) { Alert.alert('Required', 'Please enter a category name.'); return; }
    const cat: Category = {
      id: editingCat?.id ?? makeId(),
      name: catName.trim(),
      color: catColor,
      icon: editingCat?.icon ?? DEFAULT_ICON,
      parentId: editingParentId,
    };
    await upsertCategory(db, cat);
    setModalVisible(false);
    await load();
  };

  const confirmDelete = (cat: Category) => {
    const isTop = cat.parentId === '';
    const section = sections.find(s => s.parent.id === cat.id);
    const subCount = section?.data.length ?? 0;
    const message = isTop && subCount > 0
      ? `This will also delete ${subCount} sub-category${subCount > 1 ? 'ies' : 'y'}. Are you sure?`
      : `Delete "${cat.name}"?`;
    Alert.alert('Delete Category', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteCategory(db, cat.id); await load(); },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
        <TouchableOpacity onPress={() => openAdd('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          const top = section.parent;
          return (
            <View style={styles.topRow}>
              <View style={[styles.colorDot, { backgroundColor: top.color }]} />
              <Text style={styles.topName}>{top.name}</Text>
              <TouchableOpacity onPress={() => openAdd(top.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(top)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="pencil-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(top)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          );
        }}
        renderItem={({ item: sub }) => (
          <View style={styles.subRow}>
            <View style={[styles.subLine, { backgroundColor: sub.color + '60' }]} />
            <Text style={styles.subName}>{sub.name}</Text>
            <TouchableOpacity onPress={() => openEdit(sub)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(sub)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
        renderSectionFooter={({ section }) => (
          <View style={{ height: 8 }} />
        )}
      />

      {/* Add/Edit modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingCat ? 'Edit Category' : editingParentId ? 'New Sub-category' : 'New Category'}
              </Text>
              <TouchableOpacity onPress={save} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Category name"
                placeholderTextColor={Colors.textMuted}
                value={catName}
                onChangeText={setCatName}
                autoFocus
              />

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Color</Text>
              <View style={styles.colorRow}>
                {CATEGORY_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDotLarge, { backgroundColor: c }, catColor === c && styles.colorSelected]}
                    onPress={() => setCatColor(c)}
                  />
                ))}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: Colors.text },
  list: { paddingHorizontal: 16, paddingBottom: 20 },

  topRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  topName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },

  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 2, marginLeft: 14,
    backgroundColor: Colors.surface, borderRadius: 10,
  },
  subLine: { width: 3, height: 18, borderRadius: 2 },
  subName: { flex: 1, fontSize: 14, color: Colors.text },

  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  modalCancel: { fontSize: 16, color: Colors.textMuted },
  modalSaveBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorDotLarge: { width: 36, height: 36, borderRadius: 18 },
  colorSelected: { borderWidth: 3, borderColor: Colors.text },
});
