import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { buildDailyUsage, calculateChange, formatDuration } from '../usage';
import { Icon, PageHeader, ProgressBar, uiStyles } from '../components/UI';
import { WeeklyChart } from './HomeScreen';

const RANGE_DAYS = { 今天: 1, '7天': 7, '30天': 30 };

function Metric({ icon, title, value, color }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><Icon name={icon} size={23} color={color} /></View><View><Text style={styles.metricTitle}>{title}</Text><Text style={[styles.metricValue, { color }]}>{value}</Text></View></View>;
}

export function StatsScreen({ applications, usageHistory }) {
  const [range, setRange] = useState('7天');
  const days = RANGE_DAYS[range];
  const dailyUsage = useMemo(() => buildDailyUsage(usageHistory, days), [usageHistory, days]);
  const previousUsage = useMemo(() => buildDailyUsage(usageHistory, days, -days), [usageHistory, days]);
  const dates = useMemo(() => new Set(dailyUsage.map((item) => item.date)), [dailyUsage]);
  const records = useMemo(() => usageHistory.filter((record) => dates.has(record.date)), [usageHistory, dates]);
  const totalSeconds = dailyUsage.reduce((sum, item) => sum + item.seconds, 0);
  const previousSeconds = previousUsage.reduce((sum, item) => sum + item.seconds, 0);
  const change = calculateChange(totalSeconds, previousSeconds);
  const comparison = change === null ? '暂无对比' : change === 0 ? '持平' : `${change > 0 ? '+' : ''}${change}%`;
  const comparisonColor = change !== null && change > 0 ? C.warning : C.success;

  const ranking = useMemo(() => {
    const grouped = new Map();
    records.forEach((record) => {
      const current = grouped.get(record.appId) || { ...record, usedSeconds: 0 };
      current.usedSeconds += Math.max(0, Number(record.usedSeconds) || 0);
      grouped.set(record.appId, current);
    });
    return Array.from(grouped.values()).map((item) => {
      const application = applications.find((app) => app.id === item.appId);
      return { ...item, name: application?.name || item.name, icon: application?.icon || item.icon || 'desktop-outline', color: application?.color || item.color || '#64748B' };
    }).sort((a, b) => b.usedSeconds - a.usedSeconds);
  }, [records, applications]);

  const complianceDays = useMemo(() => {
    const byDate = new Map();
    records.forEach((record) => {
      const list = byDate.get(record.date) || [];
      list.push(record);
      byDate.set(record.date, list);
    });
    return Array.from(byDate.values()).filter((dayRecords) => dayRecords.length > 0 && dayRecords.every((record) => !record.limit || record.usedSeconds < Number(record.limit) * 60)).length;
  }, [records]);

  const topSeconds = Math.max(1, ...ranking.map((item) => item.usedSeconds));
  const chartTitle = range === '今天' ? '今日娱乐时间' : `近${days}天娱乐时间`;

  return (
    <ScrollView contentContainerStyle={uiStyles.page} showsVerticalScrollIndicator={false}>
      <PageHeader title="使用统计" subtitle="数据来自受限应用实际处于前台的时间">
        <View style={styles.segment}>{Object.keys(RANGE_DAYS).map((item) => <Pressable key={item} onPress={() => setRange(item)} style={[styles.segmentItem, range === item && styles.segmentActive]}><Text style={[styles.segmentText, range === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}</View>
      </PageHeader>
      <View style={styles.metrics}><Metric icon="time-outline" title="娱乐时间" value={formatDuration(totalSeconds)} color={C.primary} /><Metric icon={change !== null && change > 0 ? 'trending-up-outline' : 'trending-down-outline'} title={`较前${days}天`} value={comparison} color={comparisonColor} /><Metric icon="calendar-outline" title="遵守规则" value={`${complianceDays}天`} color="#3B82F6" /></View>
      <View style={styles.grid}>
        <View style={[uiStyles.card, styles.chartCard]}><Text style={uiStyles.sectionTitle}>{chartTitle}</Text><WeeklyChart data={dailyUsage} large /></View>
        <View style={[uiStyles.card, styles.rankCard]}>
          <Text style={uiStyles.sectionTitle}>应用排行</Text>
          {ranking.length > 0 ? ranking.map((app, index) => <View key={app.appId} style={styles.rankRow}><Text style={styles.rankNumber}>{index + 1}</Text><View style={[styles.appIcon, { backgroundColor: app.color }]}><Icon name={app.icon} size={17} color="#FFF" /></View><View style={styles.rankInfo}><Text style={styles.rankName}>{app.name}</Text><ProgressBar value={app.usedSeconds / topSeconds * 100} color={index === 0 ? C.primary : '#A5B4FC'} /></View><Text style={styles.rankTime}>{formatDuration(app.usedSeconds)}</Text></View>) : <View style={styles.empty}><Icon name="stats-chart-outline" size={30} color={C.muted} /><Text style={styles.emptyTitle}>这段时间还没有记录</Text><Text style={styles.emptyText}>打开已添加限制的应用并在前台使用后，统计会自动出现。</Text></View>}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { padding: 4, borderRadius: 10, backgroundColor: '#EAECF0', flexDirection: 'row' },
  segmentItem: { minWidth: 60, minHeight: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: C.secondary, fontSize: 12, fontWeight: '600' }, segmentTextActive: { color: C.primary },
  metrics: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' }, metric: { flex: 1, minWidth: 210, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13 }, metricIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, metricTitle: { color: C.secondary, fontSize: 12 }, metricValue: { fontSize: 21, fontWeight: '900', marginTop: 3 },
  grid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' }, chartCard: { flex: 1.4, minWidth: 430, height: 350, padding: 20 }, rankCard: { flex: 1, minWidth: 330, minHeight: 350, padding: 20, gap: 9 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F2F5' }, rankNumber: { width: 15, color: C.muted, fontWeight: '800', fontSize: 12 }, appIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, rankInfo: { flex: 1, gap: 6 }, rankName: { color: C.ink, fontWeight: '700', fontSize: 12 }, rankTime: { color: C.secondary, fontSize: 11 },
  empty: { flex: 1, minHeight: 245, alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyTitle: { color: C.ink, fontSize: 14, fontWeight: '800', marginTop: 10 }, emptyText: { color: C.secondary, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 260 }
});
