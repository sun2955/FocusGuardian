import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors as C } from '../theme';
import { buildDailyUsage, calculateChange, formatDuration } from '../usage';
import { Button, Icon, PageHeader, ProgressBar, StatusPill, uiStyles } from '../components/UI';

function UsageRing({ applications }) {
  const radius = 91;
  const circumference = Math.PI * 2 * radius;
  const enabled = applications.filter((app) => app.enabled !== false);
  const totalSeconds = enabled.reduce((sum, app) => sum + Math.max(0, Number(app.limit) || 0) * 60 + Math.max(0, Number(app.extraSeconds) || 0), 0);
  const usedSeconds = enabled.reduce((sum, app) => {
    const limitSeconds = Math.max(0, Number(app.limit) || 0) * 60 + Math.max(0, Number(app.extraSeconds) || 0);
    return sum + Math.min(Math.max(0, Number(app.quotaUsedSeconds ?? app.usedSeconds) || Number(app.used) * 60 || 0), limitSeconds);
  }, 0);
  const remainingSeconds = Math.max(0, totalSeconds - usedSeconds);
  const percent = totalSeconds > 0 ? Math.min(1, usedSeconds / totalSeconds) : 0;

  return (
    <View style={styles.ringWrap}>
      <Svg width="230" height="230" viewBox="0 0 230 230" style={styles.ringSvg}>
        <Circle cx="115" cy="115" r={radius} stroke="#E8ECF3" strokeWidth="18" fill="none" />
        <Circle cx="115" cy="115" r={radius} stroke={C.primary} strokeWidth="18" fill="none" strokeLinecap="round" strokeDasharray={`${circumference * percent} ${circumference}`} transform="rotate(-90 115 115)" />
      </Svg>
      <View style={styles.ringCopy}>
        <Text style={styles.ringLabel}>{totalSeconds > 0 ? '当前剩余额度' : '暂无规则'}</Text>
        <Text style={styles.ringValue}>{totalSeconds > 0 ? formatDuration(remainingSeconds) : '先添加限制'}</Text>
        <Text style={styles.ringCaption}>{totalSeconds > 0 ? `今日额度 ${formatDuration(totalSeconds)}` : '使用记录会自动统计'}</Text>
      </View>
    </View>
  );
}

function AppCard({ app }) {
  const usedSeconds = Math.max(0, Number(app.quotaUsedSeconds ?? app.usedSeconds) || Number(app.used) * 60 || 0);
  const limitSeconds = Math.max(0, Number(app.limit) || 0) * 60 + Math.max(0, Number(app.extraSeconds) || 0);
  const percent = limitSeconds > 0 ? Math.min(100, Math.round((usedSeconds / limitSeconds) * 100)) : 0;
  const status = app.status || '尚未使用';
  return (
    <View style={styles.appCard}>
      <View style={[styles.appIcon, { backgroundColor: app.color }]}><Icon name={app.icon} size={23} color="#FFFFFF" /></View>
      <View style={styles.appInfo}>
        <View style={styles.appTitleRow}><View><Text style={styles.appName}>{app.name}</Text><Text style={styles.appMeta}>额度已用 {formatDuration(usedSeconds)} / {formatDuration(limitSeconds)}</Text></View><StatusPill label={status} tone={status.includes('还剩') || status === '已启用' ? 'warning' : status === '已限制' || status === '额度已用完' ? 'danger' : 'success'} /></View>
        <View style={styles.progressRow}><ProgressBar value={percent} /><Text style={styles.percent}>{percent}%</Text></View>
      </View>
    </View>
  );
}

export function WeeklyChart({ data = [], large = false }) {
  const width = large ? 650 : 760;
  const height = large ? 220 : 130;
  const count = Math.max(1, data.length);
  const gap = width / count;
  const barWidth = Math.min(large ? 32 : 24, Math.max(7, gap * 0.42));
  const maxHours = Math.max(1, ...data.map((item) => item.value || 0)) * 1.12;

  return (
    <View style={[styles.chartWrap, large && styles.chartLarge]}>
      <Svg width="100%" height={height + 28} viewBox={`0 0 ${width} ${height + 28}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((part) => <Line key={part} x1="0" x2={width} y1={height * part} y2={height * part} stroke="#EEF0F4" strokeWidth="1" />)}
        {data.map((item, index) => {
          const barHeight = item.value > 0 ? Math.max(4, item.value / maxHours * (height - 18)) : 0;
          const centerX = index * gap + gap / 2;
          const showValue = data.length <= 7 && item.seconds > 0;
          return <React.Fragment key={item.date}><SvgText x={centerX} y={Math.max(12, height - barHeight - 8)} fill={C.secondary} fontSize={large ? 11 : 9} fontWeight="700" textAnchor="middle">{showValue ? formatDuration(item.seconds, true) : ''}</SvgText><Rect x={centerX - barWidth / 2} y={height - barHeight} width={barWidth} height={barHeight} rx={barWidth / 2} fill={index === data.length - 1 ? C.primary : '#9AA5FF'} /></React.Fragment>;
        })}
      </Svg>
      <View style={styles.chartLabels}>{data.map((item, index) => <Text key={item.date} style={styles.chartLabel}>{data.length <= 7 || index % 5 === 0 || index === data.length - 1 ? (data.length <= 7 ? item.day : item.shortDate) : ''}</Text>)}</View>
    </View>
  );
}

export function HomeScreen({ applications, usageHistory, onCreate }) {
  const weeklyUsage = useMemo(() => buildDailyUsage(usageHistory, 7), [usageHistory]);
  const previousWeek = useMemo(() => buildDailyUsage(usageHistory, 7, -7), [usageHistory]);
  const totalSeconds = weeklyUsage.reduce((sum, item) => sum + item.seconds, 0);
  const previousSeconds = previousWeek.reduce((sum, item) => sum + item.seconds, 0);
  const change = calculateChange(totalSeconds, previousSeconds);
  const comparison = change === null ? '暂无上周数据' : change === 0 ? '与上周持平' : `较上周 ${change > 0 ? '+' : ''}${change}%`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  return (
    <ScrollView contentContainerStyle={uiStyles.page} showsVerticalScrollIndicator={false}>
      <PageHeader title={`${greeting}，今天专注一点`} subtitle="少一点娱乐，多一点热爱生活的时间"><StatusPill /></PageHeader>
      <View style={styles.heroGrid}>
        <View style={[uiStyles.card, styles.ringPanel]}><UsageRing applications={applications} /></View>
        <View style={styles.appsPanel}>
          <View style={styles.sectionHeader}><View><Text style={uiStyles.sectionTitle}>应用限制</Text><Text style={uiStyles.sectionHint}>今天的真实使用进度</Text></View><Button icon="add" onPress={onCreate} style={styles.compactButton}>添加限制</Button></View>
          {applications.length > 0 ? applications.map((app) => <AppCard key={app.id} app={app} />) : <View style={styles.emptyCard}><Icon name="hourglass-outline" size={28} color={C.muted} /><Text style={styles.emptyTitle}>还没有限制规则</Text><Text style={styles.emptyText}>添加正在运行的应用后，时之界会自动记录它在前台的使用时间。</Text></View>}
        </View>
      </View>
      <View style={[uiStyles.card, styles.chartCard]}>
        <View style={styles.sectionHeader}><View><Text style={uiStyles.sectionTitle}>本周娱乐应用使用时长</Text><Text style={uiStyles.sectionHint}>每天实际处于前台的活跃时间</Text></View><View style={styles.weekSummary}><View style={styles.summaryItem}><Text style={styles.summaryLabel}>本周累计</Text><Text style={styles.summaryValue}>{formatDuration(totalSeconds)}</Text></View><View style={styles.summaryDivider} /><View style={styles.summaryItem}><Text style={styles.summaryLabel}>日均时长</Text><Text style={styles.summaryValue}>{formatDuration(Math.round(totalSeconds / 7))}</Text></View><StatusPill label={comparison} tone={change !== null && change > 0 ? 'warning' : 'success'} /></View></View>
        <WeeklyChart data={weeklyUsage} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroGrid: { flexDirection: 'row', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' },
  ringPanel: { flex: 0.8, minWidth: 320, minHeight: 330, alignItems: 'center', justifyContent: 'center' },
  appsPanel: { flex: 1.4, minWidth: 430, gap: 12 },
  ringWrap: { width: 230, height: 230, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute' }, ringCopy: { alignItems: 'center' },
  ringLabel: { color: C.secondary, fontSize: 14, fontWeight: '600' }, ringValue: { color: C.ink, fontSize: 30, fontWeight: '900', marginTop: 7 }, ringCaption: { color: C.muted, fontSize: 12, marginTop: 9 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, compactButton: { minHeight: 38 },
  appCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, padding: 13, borderRadius: 13 },
  appIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, appInfo: { flex: 1 },
  appTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, appName: { color: C.ink, fontSize: 15, fontWeight: '800' }, appMeta: { color: C.secondary, fontSize: 12, marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 }, percent: { width: 34, color: C.secondary, fontSize: 11, textAlign: 'right' },
  chartCard: { padding: 20 }, chartWrap: { height: 165, marginTop: 8 }, chartLarge: { height: 270, marginTop: 15 },
  weekSummary: { flexDirection: 'row', alignItems: 'center', gap: 13 }, summaryItem: { alignItems: 'flex-end' }, summaryLabel: { color: C.muted, fontSize: 9 }, summaryValue: { color: C.ink, fontSize: 12, fontWeight: '800', marginTop: 3 }, summaryDivider: { width: 1, height: 29, backgroundColor: C.line },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -24 }, chartLabel: { color: C.muted, fontSize: 11, flex: 1, textAlign: 'center' },
  emptyCard: { minHeight: 190, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 28 }, emptyTitle: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: 10 }, emptyText: { color: C.secondary, fontSize: 12, lineHeight: 19, marginTop: 6, maxWidth: 330, textAlign: 'center' }
});
