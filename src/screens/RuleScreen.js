import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors as C } from '../theme';
import { Button, Icon, uiStyles } from '../components/UI';

function ModeCard({ selected, onPress, icon, title, copy }) {
  return <Pressable onPress={onPress} style={[styles.modeCard, selected && styles.modeActive]}><View style={[styles.modeIcon, selected && styles.modeIconActive]}><Icon name={icon} size={23} color={selected ? '#FFFFFF' : C.success} /></View><View style={styles.modeCopy}><Text style={styles.modeTitle}>{title}</Text><Text style={styles.modeDescription}>{copy}</Text></View><View style={[styles.radio, selected && styles.radioActive]}>{selected ? <View style={styles.radioDot} /> : null}</View></Pressable>;
}

export function RuleScreen({ applications, initialRule, onDone, onSave }) {
  const isEditing = Boolean(initialRule);
  const [selected, setSelected] = useState(initialRule?.id || null);
  const [runningApplications, setRunningApplications] = useState(initialRule ? [initialRule] : []);
  const [processMessage, setProcessMessage] = useState('');
  const [loadingProcesses, setLoadingProcesses] = useState(!initialRule);
  const [minutes, setMinutes] = useState(initialRule?.limit || 60);
  const [weekdays, setWeekdays] = useState(initialRule?.weekdays || ['一', '二', '三', '四', '五', '六', '日']);
  const [mode, setMode] = useState(initialRule?.mode || 'standard');
  const [category, setCategory] = useState(initialRule?.category || '其他');
  const [startTime, setStartTime] = useState(initialRule?.startTime || '00:00');
  const [endTime, setEndTime] = useState(initialRule?.endTime || '24:00');
  const [warningMinutes, setWarningMinutes] = useState(initialRule?.warningMinutes ?? 5);
  const toggleDay = (day) => setWeekdays((old) => old.includes(day) ? old.filter((item) => item !== day) : [...old, day]);
  const applySchedule = (start, end) => { setStartTime(start); setEndTime(end); setProcessMessage(''); };

  const loadRunningApplications = async () => {
    if (!globalThis.focusGuardian?.getRunningApplications) {
      setProcessMessage('请在桌面客户端中查看当前运行的应用');
      setLoadingProcesses(false);
      return;
    }

    setLoadingProcesses(true);
    setProcessMessage('');
    try {
      const processes = await globalThis.focusGuardian.getRunningApplications();
      setRunningApplications(processes);
      setSelected((current) => processes.some((item) => item.id === current) ? current : null);
      if (processes.length === 0) setProcessMessage('暂未发现已打开窗口的应用，请先启动想要限制的软件');
    } catch (error) {
      setProcessMessage(error?.message || '无法读取运行中的应用，请重试');
    } finally {
      setLoadingProcesses(false);
    }
  };

  useEffect(() => {
    if (initialRule) {
      setRunningApplications([initialRule]);
      setSelected(initialRule.id);
      setLoadingProcesses(false);
      return;
    }
    loadRunningApplications();
  }, [initialRule]);

  const createRule = () => {
    const application = runningApplications.find((item) => item.id === selected) || initialRule;
    if (!application) {
      setProcessMessage('请先选择一个正在运行的应用');
      return;
    }
    if (!isEditing && applications.some((item) => item.id === application.id)) {
      setProcessMessage('这个应用已经有一条限制规则，请返回列表直接编辑');
      return;
    }
    if (weekdays.length === 0) {
      setProcessMessage('请至少选择一个生效日期');
      return;
    }
    const validTime = (value, allowEndOfDay = false) => {
      if (allowEndOfDay && value === '24:00') return true;
      const match = /^(\d{2}):(\d{2})$/.exec(value);
      return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
    };
    if (!validTime(startTime) || !validTime(endTime, true)) {
      setProcessMessage('请输入正确的生效时间，例如 18:00—23:00');
      return;
    }
    const existing = applications.find((item) => item.id === application.id);
    const today = new Date();
    const usageDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    onSave({
      ...existing,
      ...application,
      icon: existing?.icon || 'desktop-outline',
      color: existing?.color || '#64748B',
      used: existing ? (existing.used || 0) : 0,
      usedSeconds: existing ? (existing.usedSeconds || 0) : 0,
      usageDate: existing?.usageDate || usageDate,
      limit: Math.min(1440, Math.max(5, Number(minutes) || 5)),
      status: existing?.status || '尚未使用',
      enabled: existing?.enabled !== false,
      weekdays,
      startTime,
      endTime,
      warningMinutes,
      mode,
      category
    });
  };
  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}><Pressable onPress={onDone} style={styles.back}><Icon name="chevron-back" size={22} color={C.ink} /></Pressable><View><Text style={styles.pageTitle}>{isEditing ? '编辑限制规则' : '创建限制规则'}</Text><Text style={styles.pageSubtitle}>{isEditing ? '修改后立即应用新的限制设置' : '设置后将立即开始保护'}</Text></View></View>
      <View style={styles.steps}>{['选择应用', '设置额度', '限制方式', '完成'].map((label, index) => <View key={label} style={styles.stepItem}><View style={[styles.stepCircle, index === 0 && styles.stepActive]}><Text style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>{index + 1}</Text></View><Text style={[styles.stepLabel, index === 0 && styles.stepLabelActive]}>{label}</Text>{index < 3 ? <View style={styles.stepLine} /> : null}</View>)}</View>
      <View style={[uiStyles.card, styles.form]}>
        <View style={styles.processHeader}><View><Text style={styles.fieldLabel}>{isEditing ? '受限制的应用' : '选择正在运行的应用'}</Text><Text style={styles.processDescription}>{isEditing ? '编辑规则时保留原来的应用程序' : '仅显示当前已打开窗口的软件'}</Text></View>{!isEditing ? <Pressable onPress={loadRunningApplications} disabled={loadingProcesses} style={styles.refreshButton}><Icon name="refresh" size={16} color={C.primary} /><Text style={styles.refreshText}>{loadingProcesses ? '正在读取' : '刷新列表'}</Text></Pressable> : null}</View>
        <View style={styles.processList}>
          {runningApplications.map((app) => <Pressable key={app.id} disabled={isEditing} onPress={() => { setSelected(app.id); setProcessMessage(''); }} style={[styles.processRow, selected === app.id && styles.processRowActive]}><View style={[styles.processIcon, selected === app.id && styles.processIconActive]}><Icon name="desktop-outline" color={selected === app.id ? '#FFFFFF' : C.secondary} size={21} /></View><View style={styles.processInfo}><Text numberOfLines={1} style={styles.processName}>{app.name}</Text><Text numberOfLines={1} style={styles.processWindow}>{isEditing ? '已添加的限制规则' : app.windowTitle}</Text><Text numberOfLines={1} style={styles.processPath}>{app.path}</Text></View>{!isEditing ? <Text style={styles.processPid}>PID {app.pid}</Text> : null}{selected === app.id ? <View style={styles.processCheck}><Icon name="checkmark" size={14} color="#FFFFFF" /></View> : null}</Pressable>)}
          {loadingProcesses ? <View style={styles.emptyState}><Icon name="hourglass-outline" size={24} color={C.muted} /><Text style={styles.emptyText}>正在读取运行中的应用…</Text></View> : null}
        </View>
        {processMessage ? <Text style={styles.processMessage}>{processMessage}</Text> : null}
        <Text style={styles.fieldLabel}>设置额度</Text>
        <View style={styles.fieldRow}><Text style={styles.fieldName}>每日可用</Text><View style={styles.stepper}><Pressable style={styles.stepperButton} onPress={() => setMinutes(Math.max(5, minutes - 5))}><Icon name="remove" color={C.primary} /></Pressable><TextInput value={String(minutes)} onChangeText={(text) => setMinutes(Number(text.replace(/\D/g, '')) || 5)} style={styles.minuteInput} /><Text style={styles.unit}>分钟</Text><Pressable style={styles.stepperButton} onPress={() => setMinutes(minutes + 5)}><Icon name="add" color={C.primary} /></Pressable></View></View>
        <View style={styles.fieldRow}><Text style={styles.fieldName}>生效日期</Text><View style={styles.days}>{['一', '二', '三', '四', '五', '六', '日'].map((day) => <Pressable key={day} onPress={() => toggleDay(day)} style={[styles.day, weekdays.includes(day) && styles.dayActive]}><Text style={[styles.dayText, weekdays.includes(day) && styles.dayTextActive]}>周{day}</Text></Pressable>)}</View></View>
        <View style={styles.scheduleField}><View><Text style={styles.fieldName}>限制时段</Text><Text style={styles.categoryHint}>支持跨午夜时段，例如 22:00—02:00</Text></View><View style={styles.scheduleControls}><View style={styles.schedulePresets}><Pressable onPress={() => applySchedule('00:00', '24:00')} style={[styles.smallChip, startTime === '00:00' && endTime === '24:00' && styles.smallChipActive]}><Text style={[styles.smallChipText, startTime === '00:00' && endTime === '24:00' && styles.smallChipTextActive]}>全天</Text></Pressable><Pressable onPress={() => applySchedule('18:00', '23:00')} style={[styles.smallChip, startTime === '18:00' && endTime === '23:00' && styles.smallChipActive]}><Text style={[styles.smallChipText, startTime === '18:00' && endTime === '23:00' && styles.smallChipTextActive]}>晚间</Text></Pressable></View><View style={styles.timeInputs}><TextInput value={startTime} maxLength={5} onChangeText={setStartTime} placeholder="00:00" style={styles.timeInput} /><Text style={styles.timeDivider}>至</Text><TextInput value={endTime} maxLength={5} onChangeText={setEndTime} placeholder="24:00" style={styles.timeInput} /></View></View></View>
        <View style={styles.fieldRow}><View><Text style={styles.fieldName}>到时前提醒</Text><Text style={styles.categoryHint}>通过 Windows 通知提醒你及时收尾</Text></View><View style={styles.warningOptions}>{[0, 5, 10, 15].map((value) => <Pressable key={value} onPress={() => setWarningMinutes(value)} style={[styles.smallChip, warningMinutes === value && styles.smallChipActive]}><Text style={[styles.smallChipText, warningMinutes === value && styles.smallChipTextActive]}>{value === 0 ? '关闭' : `${value}分钟`}</Text></Pressable>)}</View></View>
        <View style={styles.categoryField}><View><Text style={styles.fieldName}>应用分类</Text><Text style={styles.categoryHint}>用于整理和筛选限制规则</Text></View><View style={styles.categories}>{['游戏', '影音', '社交', '购物', '阅读', '其他'].map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, category === item && styles.categoryChipActive]}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text></Pressable>)}</View></View>
        <Text style={styles.fieldLabel}>限制方式</Text>
        <View style={styles.modeRow}><ModeCard selected={mode === 'gentle'} onPress={() => setMode('gentle')} icon="leaf" title="温和模式" copy="到时提醒，可临时延长" /><ModeCard selected={mode === 'standard'} onPress={() => setMode('standard')} icon="shield-checkmark" title="标准模式" copy="到时关闭并阻止再次启动" /></View>
        <View style={styles.actions}><Button secondary onPress={onDone} style={styles.action}>取消</Button><Button onPress={createRule} style={styles.action}>{isEditing ? '保存修改' : '创建规则'}</Button></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 30, maxWidth: 920, width: '100%', alignSelf: 'center', gap: 22 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, back: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, pageTitle: { color: C.ink, fontWeight: '800', fontSize: 28 }, pageSubtitle: { color: C.secondary, fontSize: 14, marginTop: 7 },
  steps: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 18 }, stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, stepCircle: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#EAECF0', alignItems: 'center', justifyContent: 'center' }, stepActive: { backgroundColor: C.primary }, stepNumber: { color: C.secondary, fontSize: 12, fontWeight: '800' }, stepNumberActive: { color: '#FFFFFF' }, stepLabel: { color: C.muted, fontSize: 12, fontWeight: '600' }, stepLabelActive: { color: C.ink }, stepLine: { flex: 1, height: 1, backgroundColor: C.line, marginHorizontal: 8 },
  form: { padding: 24, gap: 17 }, fieldLabel: { color: C.ink, fontWeight: '800', fontSize: 14, marginTop: 2 }, processHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, processDescription: { color: C.muted, fontSize: 11, marginTop: 4 }, refreshButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 6 }, refreshText: { color: C.primary, fontSize: 11, fontWeight: '700' }, processList: { borderWidth: 1, borderColor: C.line, borderRadius: 12, overflow: 'hidden' }, processRow: { minHeight: 72, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', position: 'relative' }, processRowActive: { backgroundColor: '#F7F7FF' }, processIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center' }, processIconActive: { backgroundColor: C.primary }, processInfo: { flex: 1, minWidth: 0 }, processName: { color: C.ink, fontSize: 13, fontWeight: '800' }, processWindow: { color: C.secondary, fontSize: 11, marginTop: 3 }, processPath: { color: C.muted, fontSize: 9, marginTop: 3 }, processPid: { color: C.muted, fontSize: 9, marginRight: 27 }, processCheck: { position: 'absolute', right: 13, width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }, emptyState: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 }, emptyText: { color: C.muted, fontSize: 12 }, processMessage: { color: '#B45309', fontSize: 12, marginTop: -8 },
  fieldRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', paddingBottom: 12 }, fieldName: { color: C.secondary, fontSize: 13, fontWeight: '600' }, stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 }, stepperButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }, minuteInput: { width: 60, height: 38, borderRadius: 8, borderWidth: 1, borderColor: C.line, textAlign: 'center', color: C.ink, fontWeight: '800', fontSize: 16 }, unit: { color: C.secondary, fontSize: 12 },
  days: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }, day: { minWidth: 44, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }, dayActive: { backgroundColor: C.primary }, dayText: { color: C.secondary, fontSize: 11, fontWeight: '700' }, dayTextActive: { color: '#FFFFFF' },
  scheduleField: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', paddingBottom: 12 }, scheduleControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', flex: 1 }, schedulePresets: { flexDirection: 'row', gap: 6 }, timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 }, timeInput: { width: 68, height: 34, borderWidth: 1, borderColor: C.line, borderRadius: 8, textAlign: 'center', color: C.ink, fontWeight: '700', fontSize: 12 }, timeDivider: { color: C.muted, fontSize: 11 }, warningOptions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }, smallChip: { minHeight: 32, paddingHorizontal: 11, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, smallChipActive: { backgroundColor: C.primarySoft, borderColor: '#A5B4FC' }, smallChipText: { color: C.secondary, fontSize: 11, fontWeight: '700' }, smallChipTextActive: { color: C.primary },
  categoryField: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', paddingBottom: 13 }, categoryHint: { color: C.muted, fontSize: 10, marginTop: 4 }, categories: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7, flex: 1 }, categoryChip: { minWidth: 52, height: 32, borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, categoryChipActive: { backgroundColor: C.primarySoft, borderColor: '#A5B4FC' }, categoryText: { color: C.secondary, fontSize: 11, fontWeight: '700' }, categoryTextActive: { color: C.primary },
  modeRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }, modeCard: { flex: 1, minWidth: 280, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, modeActive: { borderWidth: 2, borderColor: C.primary, backgroundColor: '#FAFAFF' }, modeIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: C.successSoft, alignItems: 'center', justifyContent: 'center' }, modeIconActive: { backgroundColor: C.primary }, modeCopy: { flex: 1 }, modeTitle: { color: C.ink, fontSize: 14, fontWeight: '800' }, modeDescription: { color: C.secondary, fontSize: 11, marginTop: 4 }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#C5CAD3', alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: C.primary }, radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 5 }, action: { width: 130 }
});
