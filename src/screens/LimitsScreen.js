import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { Button, Icon, PageHeader, StatusPill, uiStyles } from '../components/UI';
import { RuleActionModal } from '../components/RuleActionModal';

function describeSchedule(app) {
  const start = app.startTime || '00:00';
  const end = app.endTime || '24:00';
  const period = start === '00:00' && end === '24:00' ? '全天生效' : `${start}—${end}`;
  const days = Array.isArray(app.weekdays) && app.weekdays.length < 7 ? app.weekdays.map((day) => `周${day}`).join('、') : '每天';
  return `${days} ${period}`;
}

export function LimitsScreen({ applications, onCreate, onEdit, onBlock, onToggle, onDelete }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [activeCategory, setActiveCategory] = useState('全部');
  const categoryCounts = useMemo(() => applications.reduce((counts, app) => {
    const category = app.category || '其他';
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {}), [applications]);
  const categories = ['全部', ...['游戏', '影音', '社交', '购物', '阅读', '其他'].filter((category) => categoryCounts[category])];
  const visibleApplications = activeCategory === '全部' ? applications : applications.filter((app) => (app.category || '其他') === activeCategory);

  useEffect(() => {
    if (activeCategory !== '全部' && !categoryCounts[activeCategory]) setActiveCategory('全部');
  }, [activeCategory, categoryCounts]);

  const toggleMenu = (id) => {
    setOpenMenu((current) => current === id ? null : id);
  };

  const requestPause = (app) => {
    if (app.enabled === false) {
      onToggle(app.id);
      setOpenMenu(null);
      return;
    }
    setOpenMenu(null);
    setPendingAction({ type: 'pause', application: app });
  };

  const confirmAction = (type, app) => {
    if (type === 'pause') onToggle(app.id);
    if (type === 'delete') onDelete(app.id);
    setPendingAction(null);
  };

  return (
    <>
    <ScrollView contentContainerStyle={uiStyles.page} showsVerticalScrollIndicator={false}>
      <PageHeader title="应用限制" subtitle="管理每天可用时长与禁止使用时段"><Button icon="add" onPress={onCreate}>添加限制</Button></PageHeader>
      {applications.length ? <View style={styles.categoryBar}>{categories.map((category) => { const selected = activeCategory === category; const count = category === '全部' ? applications.length : categoryCounts[category]; return <Pressable key={category} onPress={() => { setActiveCategory(category); setOpenMenu(null); }} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{category}</Text><View style={[styles.filterCount, selected && styles.filterCountActive]}><Text style={[styles.filterCountText, selected && styles.filterCountTextActive]}>{count}</Text></View></Pressable>; })}</View> : null}
      <View style={[uiStyles.card, styles.list]}>
        {visibleApplications.map((app) => (
          <View key={app.id} style={styles.ruleItem}>
            <View style={styles.row}>
              <View style={[styles.appIcon, { backgroundColor: app.enabled === false ? '#AAB0BA' : app.color }]}><Icon name={app.icon} size={23} color="#FFF" /></View>
              <View style={styles.info}><View style={styles.nameRow}><Text style={styles.name}>{app.name}</Text><View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{app.category || '其他'}</Text></View></View><Text style={styles.meta}>{app.limit} 分钟 · {describeSchedule(app)}{app.warningMinutes ? ` · 提前${app.warningMinutes}分钟提醒` : ''}</Text>{app.path ? <Text numberOfLines={1} style={styles.path}>{app.path}</Text> : null}</View>
              <StatusPill label={app.enabled === false ? '已暂停' : '已启用'} tone={app.enabled === false ? 'warning' : 'success'} />
              <Pressable accessibilityLabel={`${app.name}规则操作`} onPress={() => toggleMenu(app.id)} style={[styles.more, openMenu === app.id && styles.moreActive]}><Icon name={openMenu === app.id ? 'close' : 'ellipsis-horizontal'} color={openMenu === app.id ? C.primary : C.secondary} /></Pressable>
            </View>
            {openMenu === app.id ? (
              <View style={styles.actionPanel}>
                <Pressable onPress={() => { setOpenMenu(null); onEdit(app); }} style={styles.menuAction}><Icon name="create-outline" size={18} color={C.primary} /><Text style={styles.menuActionText}>编辑规则</Text></Pressable><View style={styles.actionDivider} /><Pressable onPress={() => requestPause(app)} style={styles.menuAction}><Icon name={app.enabled === false ? 'play-circle-outline' : 'pause-circle-outline'} size={19} color={C.primary} /><Text style={styles.menuActionText}>{app.enabled === false ? '恢复限制' : '暂停限制'}</Text></Pressable><View style={styles.actionDivider} /><Pressable onPress={() => { setOpenMenu(null); setPendingAction({ type: 'delete', application: app }); }} style={styles.menuAction}><Icon name="trash-outline" size={18} color={C.danger} /><Text style={styles.deleteText}>删除规则</Text></Pressable>
              </View>
            ) : null}
          </View>
        ))}
        {applications.length === 0 ? <View style={styles.empty}><Icon name="shield-outline" size={28} color={C.muted} /><Text style={styles.emptyTitle}>还没有应用限制</Text><Text style={styles.emptyCopy}>点击右上角“添加限制”开始设置</Text></View> : null}
        {applications.length > 0 && visibleApplications.length === 0 ? <View style={styles.empty}><Icon name="folder-open-outline" size={28} color={C.muted} /><Text style={styles.emptyTitle}>这个分类还没有应用</Text><Text style={styles.emptyCopy}>请选择其他分类查看规则</Text></View> : null}
      </View>
      <View style={styles.tip}><Icon name="bulb-outline" size={22} color={C.warning} /><View><Text style={styles.tipTitle}>建议先从容易做到的额度开始</Text><Text style={styles.tipCopy}>连续遵守一周后，再逐渐减少娱乐时间，更容易形成长期习惯。</Text></View></View>
      <Button secondary onPress={onBlock} style={styles.preview}>预览拦截页面</Button>
    </ScrollView>
    <RuleActionModal action={pendingAction} onClose={() => setPendingAction(null)} onConfirm={confirmAction} />
    </>
  );
}

const styles = StyleSheet.create({
  categoryBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterChip: { minHeight: 34, borderRadius: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line }, filterChipActive: { backgroundColor: C.primary, borderColor: C.primary }, filterText: { color: C.secondary, fontSize: 12, fontWeight: '700' }, filterTextActive: { color: '#FFFFFF' }, filterCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center' }, filterCountActive: { backgroundColor: 'rgba(255,255,255,.22)' }, filterCountText: { color: C.secondary, fontSize: 9, fontWeight: '800' }, filterCountTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: 18 }, ruleItem: { borderBottomWidth: 1, borderBottomColor: '#F0F2F5' }, row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13 },
  appIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, name: { color: C.ink, fontSize: 15, fontWeight: '800' }, categoryBadge: { minHeight: 22, borderRadius: 11, paddingHorizontal: 8, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }, categoryBadgeText: { color: C.primary, fontSize: 9, fontWeight: '800' }, meta: { color: C.secondary, fontSize: 12, marginTop: 4 },
  path: { color: C.muted, fontSize: 10, marginTop: 3 },
  more: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' }, moreActive: { backgroundColor: C.primarySoft },
  actionPanel: { minHeight: 54, backgroundColor: '#F8F9FC', borderRadius: 10, marginBottom: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }, menuAction: { minHeight: 36, paddingHorizontal: 11, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, menuActionText: { color: C.primary, fontSize: 12, fontWeight: '700' }, deleteText: { color: C.danger, fontSize: 12, fontWeight: '700' }, actionDivider: { width: 1, height: 22, backgroundColor: C.line },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: C.ink, fontSize: 14, fontWeight: '800', marginTop: 10 }, emptyCopy: { color: C.muted, fontSize: 11, marginTop: 5 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.warningSoft, padding: 17, borderRadius: 13 },
  tipTitle: { color: '#8A5900', fontWeight: '800', fontSize: 13 }, tipCopy: { color: '#9A6A16', fontSize: 12, marginTop: 4 }, preview: { alignSelf: 'flex-start' }
});
