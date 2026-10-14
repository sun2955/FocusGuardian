import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { Button, Icon, PageHeader, StatusPill, uiStyles } from '../components/UI';
import { LegalModal } from '../components/LegalModal';

export function SettingsScreen({ values, onChange, applications, usageHistory }) {
  const [legalDocument, setLegalDocument] = useState(null);
  const [appInfo, setAppInfo] = useState({ name: '时之界', version: '0.5.1', platform: 'Windows', architecture: 'x64', dataPath: '仅保存在本机' });
  const [exportState, setExportState] = useState('');
  const rows = [
    ['startup', 'power-outline', '开机自动启动', '登录 Windows 后自动运行保护服务'],
    ['idle', 'desktop-outline', '空闲5分钟后暂停计时', '没有键鼠操作时不消耗应用额度'],
    ['reset', 'time-outline', '每日00:00重置', '每天自动恢复应用可用时长'],
    ['clock', 'shield-checkmark-outline', '时间异常检测', '防止修改系统时间绕过限制']
  ];

  useEffect(() => {
    globalThis.focusGuardian?.getAppInfo?.().then(setAppInfo).catch(() => {});
    globalThis.focusGuardian?.getSettings?.().then((settings) => onChange((current) => ({ ...current, ...settings }))).catch(() => {});
  }, []);

  const exportRecords = async () => {
    setExportState('正在准备导出…');
    try {
      if (globalThis.focusGuardian?.exportUsageData) {
        const result = await globalThis.focusGuardian.exportUsageData({ applications, history: usageHistory });
        setExportState(result?.canceled ? '已取消导出' : `已导出到：${result.filePath}`);
        return;
      }
      const blob = new Blob([JSON.stringify({ applications, usageHistory }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '时之界使用记录.json';
      link.click();
      URL.revokeObjectURL(url);
      setExportState('使用记录已导出');
    } catch (error) {
      setExportState(error?.message || '导出失败，请重试');
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={uiStyles.page} showsVerticalScrollIndicator={false}>
        <PageHeader title="设置" subtitle="管理保护服务和时间计算方式" />
        <View style={[uiStyles.card, styles.card]}>
          <View style={styles.header}><View><Text style={uiStyles.sectionTitle}>保护服务</Text><Text style={uiStyles.sectionHint}>开关修改后立即保存并应用</Text></View><StatusPill label="运行正常" /></View>
          {rows.map(([id, icon, title, copy]) => <View key={id} style={styles.row}><View style={styles.icon}><Icon name={icon} size={21} color={C.ink} /></View><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{copy}</Text></View><Switch value={values[id]} onValueChange={(value) => onChange((old) => ({ ...old, [id]: value }))} trackColor={{ false: '#D0D5DD', true: '#A5B4FC' }} thumbColor={values[id] ? C.primary : '#FFFFFF'} /></View>)}
        </View>
        <View style={[uiStyles.card, styles.card]}><Text style={uiStyles.sectionTitle}>数据与隐私</Text><Text style={styles.privacy}>规则、设置和使用记录保存在独立的本机 SQLite 数据库中，正常卸载或升级不会删除。应用不会上传你的程序列表和使用记录。导出文件为可用 Excel 打开的 CSV。</Text><Button secondary icon="download-outline" style={styles.export} onPress={exportRecords}>导出使用记录</Button>{exportState ? <Text numberOfLines={2} style={styles.exportState}>{exportState}</Text> : null}</View>
        <View style={[uiStyles.card, styles.aboutCard]}>
          <View style={styles.aboutTop}><Image source={require('../../assets/icon.png')} style={styles.appMark} /><View style={styles.aboutName}><Text style={styles.appName}>{appInfo.name}</Text><Text style={styles.version}>版本 {appInfo.version}</Text></View><View style={styles.localBadge}><Icon name="desktop-outline" size={15} color={C.success} /><Text style={styles.localBadgeText}>本地版</Text></View></View>
          <View style={styles.infoGrid}><View style={styles.infoItem}><Text style={styles.infoLabel}>运行平台</Text><Text style={styles.infoValue}>{appInfo.platform} · {appInfo.architecture}</Text></View><View style={styles.infoItem}><Text style={styles.infoLabel}>数据存储</Text><Text style={styles.infoValue}>本机 SQLite · 卸载保留</Text></View></View>
          <View style={styles.legalLinks}><Pressable onPress={() => setLegalDocument('privacy')} style={styles.legalLink}><View><Text style={styles.legalTitle}>隐私政策</Text><Text style={styles.legalCopy}>了解本机数据和进程信息如何处理</Text></View><Icon name="chevron-forward" size={18} /></Pressable><Pressable onPress={() => setLegalDocument('terms')} style={styles.legalLink}><View><Text style={styles.legalTitle}>用户协议</Text><Text style={styles.legalCopy}>查看使用规则、责任和服务说明</Text></View><Icon name="chevron-forward" size={18} /></Pressable></View>
          <Text numberOfLines={1} style={styles.dataPath}>数据目录：{appInfo.dataPath}</Text>
          <Text style={styles.copyright}>© 2026 时之界。保留所有权利。</Text>
        </View>
      </ScrollView>
      <LegalModal type={legalDocument} onClose={() => setLegalDocument(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#F4F5F7' },
  icon: { width: 42, height: 42, borderRadius: 11, backgroundColor: '#F3F4F7', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 },
  title: { color: C.ink, fontWeight: '700', fontSize: 14 }, description: { color: C.secondary, fontSize: 11, marginTop: 4 },
  privacy: { color: C.secondary, fontSize: 13, lineHeight: 21, marginTop: 10, maxWidth: 640 }, export: { alignSelf: 'flex-start', marginTop: 15 }, exportState: { color: C.secondary, fontSize: 11, marginTop: 10, maxWidth: 680 },
  aboutCard: { padding: 20, gap: 17 }, aboutTop: { flexDirection: 'row', alignItems: 'center', gap: 13 }, appMark: { width: 50, height: 50, borderRadius: 14 }, aboutName: { flex: 1 }, appName: { color: C.ink, fontSize: 17, fontWeight: '900' }, version: { color: C.secondary, fontSize: 11, marginTop: 4 }, localBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.successSoft, paddingHorizontal: 10, minHeight: 28, borderRadius: 14 }, localBadgeText: { color: C.success, fontSize: 11, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }, infoItem: { flex: 1, minWidth: 220, backgroundColor: '#F8F9FB', borderRadius: 10, padding: 13 }, infoLabel: { color: C.muted, fontSize: 10 }, infoValue: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 5 }, legalLinks: { borderTopWidth: 1, borderTopColor: C.line }, legalLink: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line }, legalTitle: { color: C.ink, fontSize: 13, fontWeight: '800' }, legalCopy: { color: C.secondary, fontSize: 10, marginTop: 4 }, dataPath: { color: C.muted, fontSize: 9 }, copyright: { color: C.muted, fontSize: 10, textAlign: 'center' }
});
