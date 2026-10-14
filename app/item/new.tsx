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
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCategories, upsertItem } from '../../src/db/database';
import { ScheduleItem, Category, PeriodicType, ItemType } from '../../src/types';
import { ITEM_TYPE_CONFIG, ITEM_TYPE_ORDER } from '../../src/constants/itemTypes';
import { Colors, CATEGORY_COLORS, ACTIVITY_ICONS } from '../../src/constants/theme';
import { DAY_SHORT, MONTH_SHORT } from '../../src/utils/dates';

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const PERIODIC_TYPES: { key: PeriodicType; label: string }[] = [
  { key: 'daily',       label: 'Daily' },
  { key: 'weekly',      label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly' },
  { key: 'monthly',     label: 'Monthly' },
  { key: 'quarterly',   label: 'Quarterly' },
  { key: 'yearly',      label: 'Yearly' },
];

const QUARTER_LABELS = [
  '1st month (Jan/Apr/Jul/Oct)',
  '2nd month (Feb/May/Aug/Nov)',
  '3rd month (Mar/Jun/Sep/Dec)',
];

// Types that have a full form in Phase 1
const SUPPORTED_TYPES: ItemType[] = ['activity', 'task', 'habit'];

export default function NewItemScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ type?: string }>();

  const initialType = (params.type as ItemType | undefined) ?? 'habit';
  const [selectedType, setSelectedType] = useState<ItemType>(initialType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<Category[]>([]);

  // Basic fields
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [color, setColor]             = useState(Colors.primary);
  const [icon, setIcon]               = useState('checkmark-circle-outline');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => {
    const d = new Date(); d.setHours(8, 0, 0, 0); return d;
  });

  // Frequency
  const [periodicType, setPeriodicType]   = useState<PeriodicType>('daily');
  const [weeklyDays, setWeeklyDays]       = useState<number[]>([]);
  const [fortnightWeek1, setFortnightWeek1] = useState<number[]>([]);
  const [fortnightWeek2, setFortnightWeek2] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth]       = useState<number>(1);
  const [quarterMonth, setQuarterMonth]   = useState<number>(0);
  const [yearlyMonth, setYearlyMonth]     = useState<number>(0);
  const [targetDate, setTargetDate]       = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    getCategories(db).then(cats => {
      setCategories(cats);
      const tops = cats.filter(c => c.parentId === '');
      setTopCategories(tops);
      if (tops.length > 0) {
        setCategoryId(tops[0].id);
        setColor(tops[0].color);
      }
    });
  }, [db]);

  // Update icon default when type changes
  useEffect(() => {
    const config = ITEM_TYPE_CONFIG[selectedType];
    setIcon(config.icon);
    setColor(config.color);
  }, [selectedType]);

  const isRecurring = ITEM_TYPE_CONFIG[selectedType].isRecurring;
  const isSupported = SUPPORTED_TYPES.includes(selectedType);
  const typeConfig = ITEM_TYPE_CONFIG[selectedType];

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter a name.';
    if (isRecurring && periodicType === 'weekly' && weeklyDays.length === 0)
      return 'Please select at least one day of the week.';
    if (!isRecurring && !targetDate)
      return 'Please select a target date.';
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { Alert.alert('Required', err); return; }

    const targetDateStr = targetDate
      ? `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
      : '';

    const item: ScheduleItem = {
      id: makeId(selectedType.slice(0, 4)),
      itemType: selectedType,
      name: name.trim(),
      description: description.trim(),
      categoryId,
      subcategoryId: '',
      isRecurring,
      periodicType,
      frequencyDays: periodicType === 'weekly' ? weeklyDays
                   : periodicType === 'fortnightly' ? fortnightWeek1
                   : [],
      frequencyDays2: periodicType === 'fortnightly' ? fortnightWeek2 : [],
      frequencyDayOfMonth: dayOfMonth,
      frequencyMonth: periodicType === 'quarterly' ? quarterMonth : yearlyMonth,
      targetDate: targetDateStr,
      targetTime: '',
      reminderTime: reminderEnabled
        ? `${String(reminderDate.getHours()).padStart(2, '0')}:${String(reminderDate.getMinutes()).padStart(2, '0')}`
        : '',
      color,
      icon,
      isActive: true,
      isCompleted: false,
      completedAt: '',
      createdAt: new Date().toISOString(),
    };

    await upsertItem(db, item);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New {typeConfig.label}</Text>
          {isSupported && (
            <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: color }]}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          )}
          {!isSupported && <View style={{ width: 64 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Type Selector ── */}
          <Field label="Type">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ITEM_TYPE_ORDER.map(type => {
                const cfg = ITEM_TYPE_CONFIG[type];
                const active = selectedType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Ionicons name={cfg.icon as any} size={14} color={active ? '#fff' : Colors.textMuted} />
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Field>

          {/* Unsupported type placeholder */}
          {!isSupported && (
            <View style={styles.comingSoon}>
              <Ionicons name={typeConfig.icon as any} size={48} color={typeConfig.color + '88'} />
              <Text style={styles.comingSoonTitle}>{typeConfig.label} coming soon</Text>
              <Text style={styles.comingSoonText}>{typeConfig.description}</Text>
              <Text style={styles.comingSoonSub}>Full support for this type will be added in a future update.</Text>
            </View>
          )}

          {/* Supported type form */}
          {isSupported && (
            <>
              {/* ── Name ── */}
              <Field label="Name">
                <TextInput
                  style={styles.input}
                  placeholder={`e.g. ${selectedType === 'habit' ? 'Morning run' : selectedType === 'task' ? 'Pay bills' : 'Weekly yoga class'}`}
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </Field>

              {/* ── Description ── */}
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

              {/* ── Category ── */}
              <Field label="Category">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {topCategories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, categoryId === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                      onPress={() => { setCategoryId(cat.id); }}
                    >
                      <Ionicons name={cat.icon as any} size={14} color={categoryId === cat.id ? '#fff' : Colors.textMuted} />
                      <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Field>

              {/* ── Frequency / Schedule ── */}
              {isRecurring ? (
                <Field label="Frequency">
                  {/* Periodic sub-type chips */}
                  <View style={styles.periodicChips}>
                    {PERIODIC_TYPES.map(({ key, label }) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.periodChip, periodicType === key && { backgroundColor: color, borderColor: color }]}
                        onPress={() => setPeriodicType(key)}
                      >
                        <Text style={[styles.periodChipText, periodicType === key && styles.periodChipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Daily */}
                  {periodicType === 'daily' && (
                    <View style={styles.configNote}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                      <Text style={styles.configNoteText}>Appears every day</Text>
                    </View>
                  )}

                  {/* Weekly */}
                  {periodicType === 'weekly' && (
                    <View style={styles.configBlock}>
                      <Text style={styles.configLabel}>Which days?</Text>
                      <View style={styles.daysRow}>
                        {DAY_SHORT.map((d, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[styles.dayBtn, weeklyDays.includes(i) && { backgroundColor: color, borderColor: color }]}
                            onPress={() => setWeeklyDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                          >
                            <Text style={[styles.dayBtnText, weeklyDays.includes(i) && styles.dayBtnTextActive]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Fortnightly */}
                  {periodicType === 'fortnightly' && (
                    <View style={styles.configBlock}>
                      <View style={styles.fortnightWeekHeader}>
                        <View style={[styles.weekLabel, { backgroundColor: color + '22' }]}>
                          <Text style={[styles.weekLabelText, { color }]}>Week 1</Text>
                        </View>
                        <Text style={styles.configLabel}>Which days?</Text>
                      </View>
                      <View style={styles.daysRow}>
                        {DAY_SHORT.map((d, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[styles.dayBtn, fortnightWeek1.includes(i) && { backgroundColor: color, borderColor: color }]}
                            onPress={() => setFortnightWeek1(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                          >
                            <Text style={[styles.dayBtnText, fortnightWeek1.includes(i) && styles.dayBtnTextActive]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={[styles.fortnightWeekHeader, { marginTop: 12 }]}>
                        <View style={[styles.weekLabel, { backgroundColor: color + '22' }]}>
                          <Text style={[styles.weekLabelText, { color }]}>Week 2</Text>
                        </View>
                        <Text style={styles.configLabel}>Which days?</Text>
                      </View>
                      <View style={styles.daysRow}>
                        {DAY_SHORT.map((d, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[styles.dayBtn, fortnightWeek2.includes(i) && { backgroundColor: color, borderColor: color }]}
                            onPress={() => setFortnightWeek2(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                          >
                            <Text style={[styles.dayBtnText, fortnightWeek2.includes(i) && styles.dayBtnTextActive]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={styles.configNote}>
                        <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.configNoteText}>2-week cycle starts from the day you save this item</Text>
                      </View>
                    </View>
                  )}

                  {/* Monthly */}
                  {periodicType === 'monthly' && (
                    <View style={styles.configBlock}>
                      <Text style={styles.configLabel}>Which day of the month?</Text>
                      <DayOfMonthPicker value={dayOfMonth} color={color} onChange={setDayOfMonth} />
                    </View>
                  )}

                  {/* Quarterly */}
                  {periodicType === 'quarterly' && (
                    <View style={styles.configBlock}>
                      <Text style={styles.configLabel}>Which month in the quarter?</Text>
                      {QUARTER_LABELS.map((label, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.radioRow, quarterMonth === i && { borderColor: color }]}
                          onPress={() => setQuarterMonth(i)}
                        >
                          <View style={[styles.radio, quarterMonth === i && { backgroundColor: color, borderColor: color }]}>
                            {quarterMonth === i && <View style={styles.radioDot} />}
                          </View>
                          <Text style={styles.radioLabel}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                      <Text style={[styles.configLabel, { marginTop: 12 }]}>Which day of that month?</Text>
                      <DayOfMonthPicker value={dayOfMonth} color={color} onChange={setDayOfMonth} />
                    </View>
                  )}

                  {/* Yearly */}
                  {periodicType === 'yearly' && (
                    <View style={styles.configBlock}>
                      <Text style={styles.configLabel}>Which month?</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {MONTH_SHORT.map((m, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[styles.monthChip, yearlyMonth === i && { backgroundColor: color, borderColor: color }]}
                            onPress={() => setYearlyMonth(i)}
                          >
                            <Text style={[styles.monthChipText, yearlyMonth === i && styles.periodChipTextActive]}>{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={[styles.configLabel, { marginTop: 12 }]}>Which day of that month?</Text>
                      <DayOfMonthPicker value={dayOfMonth} color={color} onChange={setDayOfMonth} />
                    </View>
                  )}
                </Field>
              ) : (
                /* One-off date picker */
                <Field label="Target Date">
                  <TouchableOpacity
                    style={styles.dateRow}
                    onPress={() => setShowDatePicker(p => !p)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={targetDate ? color : Colors.textMuted} />
                    <Text style={[styles.dateLabelText, targetDate ? { color: Colors.text } : {}]}>
                      {targetDate
                        ? targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                        : 'Select a date'}
                    </Text>
                    <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={targetDate ?? new Date()}
                      mode="date"
                      display="inline"
                      minimumDate={new Date()}
                      accentColor={color}
                      onChange={(_event, date) => {
                        if (date) { setTargetDate(date); setShowDatePicker(false); }
                      }}
                    />
                  )}
                </Field>
              )}

              {/* ── Reminder ── */}
              <Field label="Reminder">
                <View style={styles.reminderRow}>
                  <View style={styles.reminderLeft}>
                    <Ionicons
                      name={reminderEnabled ? 'alarm' : 'alarm-outline'}
                      size={20}
                      color={reminderEnabled ? color : Colors.textMuted}
                    />
                    <Text style={[styles.reminderLabel, reminderEnabled && { color: Colors.text }]}>
                      {reminderEnabled
                        ? reminderDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        : 'No reminder'}
                    </Text>
                  </View>
                  <Switch
                    value={reminderEnabled}
                    onValueChange={setReminderEnabled}
                    trackColor={{ false: Colors.border, true: color }}
                    thumbColor={Colors.white}
                  />
                </View>
                {reminderEnabled && (
                  <DateTimePicker
                    value={reminderDate}
                    mode="time"
                    display="spinner"
                    onChange={(_event, date) => { if (date) setReminderDate(date); }}
                    style={styles.timePicker}
                  />
                )}
              </Field>

              {/* ── Color ── */}
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

              {/* ── Icon ── */}
              <Field label="Icon">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function DayOfMonthPicker({ value, color, onChange }: {
  value: number; color: string; onChange: (d: number) => void;
}) {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <View style={styles.domGrid}>
      {days.map(d => (
        <TouchableOpacity
          key={d}
          style={[styles.domCell, value === d && { backgroundColor: color, borderColor: color }]}
          onPress={() => onChange(d)}
        >
          <Text style={[styles.domText, value === d && styles.domTextActive]}>{d}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.domCellLast, value === -1 && { backgroundColor: color, borderColor: color }]}
        onPress={() => onChange(-1)}
      >
        <Text style={[styles.domText, value === -1 && styles.domTextActive]}>Last</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: Colors.textMuted },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveText: { fontSize: 15, fontWeight: '600', color: Colors.white },

  scroll: { padding: 20, gap: 20 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  input: {
    backgroundColor: Colors.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  typeChipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  typeChipTextActive: { color: Colors.white, fontWeight: '600' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: Colors.white },

  comingSoon: {
    alignItems: 'center', padding: 40, gap: 10,
    backgroundColor: Colors.background, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  comingSoonTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginTop: 4 },
  comingSoonText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  comingSoonSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },

  periodicChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  periodChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  periodChipTextActive: { color: Colors.white },

  configBlock: { gap: 10 },
  configLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  configNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  configNoteText: { fontSize: 13, color: Colors.textMuted },

  daysRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  fortnightWeekHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  weekLabel: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  weekLabelText: { fontSize: 12, fontWeight: '700' },
  dayBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    alignItems: 'center', backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  dayBtnText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  dayBtnTextActive: { color: Colors.white },

  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  radioLabel: { fontSize: 13, color: Colors.text, flex: 1 },

  monthChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    marginRight: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  monthChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  domGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  domCell: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  domCellLast: {
    paddingHorizontal: 10, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  domText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  domTextActive: { color: Colors.white },

  reminderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border,
  },
  reminderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderLabel: { fontSize: 15, color: Colors.textMuted },
  timePicker: { height: 130, marginTop: 4 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border,
  },
  dateLabelText: { flex: 1, fontSize: 15, color: Colors.textMuted },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginRight: 8, borderWidth: 1, borderColor: Colors.border,
  },
});
