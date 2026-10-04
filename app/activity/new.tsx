import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCategories, upsertActivity } from '../../src/db/database';
import { Activity, Category } from '../../src/types';
import { Colors, CATEGORY_COLORS, ACTIVITY_ICONS } from '../../src/constants/theme';
import { DAY_SHORT } from '../../src/utils/dates';

function makeId() {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function NewActivityScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequencyType, setFrequencyType] = useState<Activity['frequencyType']>('daily');
  const [frequencyDays, setFrequencyDays] = useState<number[]>([]);
  const [frequencyInterval, setFrequencyInterval] = useState('2');
  const [targetDate, setTargetDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [color, setColor] = useState(Colors.primary);
  const [icon, setIcon] = useState('checkmark-circle-outline');

  useEffect(() => {
    getCategories(db).then(cats => {
      setCategories(cats);
      if (cats.length > 0) {
        setCategoryId(cats[0].id);
        setColor(cats[0].color);
      }
    });
  }, [db]);

  const toggleDay = (day: number) => {
    setFrequencyDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this activity.');
      return;
    }
    if (frequencyType === 'weekly' && frequencyDays.length === 0) {
      Alert.alert('Select days', 'Please select at least one day of the week.');
      return;
    }
    if (frequencyType === 'once' && !targetDate) {
      Alert.alert('Date required', 'Please enter a target date (YYYY-MM-DD).');
      return;
    }

    const activity: Activity = {
      id: makeId(),
      name: name.trim(),
      description: description.trim(),
      categoryId,
      frequencyType,
      frequencyDays,
      frequencyInterval: parseInt(frequencyInterval, 10) || 1,
      targetDate,
      reminderTime,
      color,
      icon,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await upsertActivity(db, activity);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Activity</Text>
          <TouchableOpacity onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <Field label="Name">
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning run"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </Field>

          {/* Description */}
          <Field label="Description (optional)">
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Add a note..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />
          </Field>

          {/* Category */}
          <Field label="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, categoryId === cat.id && { backgroundColor: cat.color }]}
                  onPress={() => { setCategoryId(cat.id); setColor(cat.color); }}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={14}
                    color={categoryId === cat.id ? '#fff' : Colors.textMuted}
                  />
                  <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          {/* Frequency */}
          <Field label="Frequency">
            <View style={styles.segmented}>
              {(['daily', 'weekly', 'interval', 'once'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.seg, frequencyType === t && styles.segActive]}
                  onPress={() => setFrequencyType(t)}
                >
                  <Text style={[styles.segText, frequencyType === t && styles.segTextActive]}>
                    {t === 'daily' ? 'Daily' : t === 'weekly' ? 'Weekly' : t === 'interval' ? 'Every N days' : 'One-off'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {frequencyType === 'weekly' && (
              <View style={styles.daysRow}>
                {DAY_SHORT.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayBtn, frequencyDays.includes(i) && { backgroundColor: color }]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text style={[styles.dayBtnText, frequencyDays.includes(i) && styles.dayBtnTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {frequencyType === 'interval' && (
              <View style={styles.intervalRow}>
                <Text style={styles.intervalLabel}>Every</Text>
                <TextInput
                  style={styles.intervalInput}
                  value={frequencyInterval}
                  onChangeText={setFrequencyInterval}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.intervalLabel}>days</Text>
              </View>
            )}

            {frequencyType === 'once' && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Target date (YYYY-MM-DD)"
                placeholderTextColor={Colors.textMuted}
                value={targetDate}
                onChangeText={setTargetDate}
                keyboardType="numbers-and-punctuation"
              />
            )}
          </Field>

          {/* Reminder */}
          <Field label="Reminder time (optional)">
            <TextInput
              style={styles.input}
              placeholder="e.g. 08:00 (24-hour format)"
              placeholderTextColor={Colors.textMuted}
              value={reminderTime}
              onChangeText={setReminderTime}
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          {/* Color */}
          <Field label="Color">
            <View style={styles.colorRow}>
              {CATEGORY_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </Field>

          {/* Icon */}
          <Field label="Icon">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {ACTIVITY_ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBtn, icon === ic && { backgroundColor: color + '33', borderColor: color }]}
                  onPress={() => setIcon(ic)}
                >
                  <Ionicons name={ic as any} size={22} color={icon === ic ? color : Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: Colors.textMuted },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  scroll: { padding: 20, gap: 20 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  chipScroll: { flexGrow: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: Colors.white },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segActive: { backgroundColor: Colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  segTextActive: { color: Colors.text, fontWeight: '700' },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 10, justifyContent: 'space-between' },
  dayBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayBtnText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  dayBtnTextActive: { color: Colors.white },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  intervalLabel: { fontSize: 15, color: Colors.text },
  intervalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    width: 70,
    textAlign: 'center',
  },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
