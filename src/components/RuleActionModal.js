import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { Icon } from './UI';

const ENCOURAGEMENTS = [
  '真正的自律，不是从不动摇，而是动摇时仍愿意再坚持一下。',
  '你当初设置这条规则，是为了把时间留给更重要的人和事。',
  '冲动通常只持续几分钟，守住这一次，你会更相信自己。',
  '先离开屏幕喝口水，十分钟后的你会感谢现在没有放弃。',
  '已经走到这里了，再坚持今天一次，不让之前的努力白费。'
];

export function RuleActionModal({ action, onClose, onConfirm }) {
  const isDelete = action?.type === 'delete';
  const application = action?.application;
  const waitSeconds = isDelete ? 8 : 6;
  const [seconds, setSeconds] = useState(waitSeconds);

  useEffect(() => {
    if (!action) return undefined;
    setSeconds(waitSeconds);
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [action, waitSeconds]);

  const encouragement = useMemo(() => {
    const offset = isDelete ? 2 : 0;
    return ENCOURAGEMENTS[((application?.name?.length || 0) + offset) % ENCOURAGEMENTS.length];
  }, [application?.name, isDelete]);

  if (!action) return null;

  const title = isDelete ? '真的要删除这条规则吗？' : '先别急着暂停';
  const consequence = isDelete
    ? `删除后，“${application.name}”将立即失去保护，今天的规则记录也会从列表移除。`
    : `暂停后，“${application.name}”将停止计时和拦截，直到你再次手动恢复。`;
  const actionLabel = isDelete ? '仍要删除规则' : '仍要暂停限制';

  return (
    <Modal visible={Boolean(action)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={[styles.warningIcon, isDelete && styles.deleteIcon]}>
            <Icon name={isDelete ? 'trash-outline' : 'pause-circle-outline'} size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.eyebrow}>{isDelete ? '删除后无法自动恢复' : '暂停会让保护立即失效'}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.consequence}>{consequence}</Text>

          <View style={styles.ruleSummary}>
            <View style={styles.summaryIcon}><Icon name={application.icon || 'desktop-outline'} size={22} color="#FFFFFF" /></View>
            <View style={styles.summaryCopy}>
              <Text style={styles.appName}>{application.name}</Text>
              <Text style={styles.appMeta}>每天 {application.limit} 分钟 · 已使用 {application.used || 0} 分钟</Text>
            </View>
          </View>

          <View style={styles.encouragement}>
            <Icon name="sparkles" size={20} color={C.primary} />
            <Text style={styles.encouragementText}>{encouragement}</Text>
          </View>

          <Text style={styles.cooldownCopy}>
            {seconds > 0 ? `给自己 ${seconds} 秒再想一想` : '如果你仍然确定，可以继续操作'}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.keepButton, pressed && styles.pressed]}>
              <Icon name="shield-checkmark" size={19} color="#FFFFFF" />
              <Text style={styles.keepText}>我再坚持一下</Text>
            </Pressable>
            <Pressable
              disabled={seconds > 0}
              accessibilityState={{ disabled: seconds > 0 }}
              onPress={() => onConfirm(action.type, application)}
              style={({ pressed }) => [styles.destructiveButton, seconds > 0 && styles.disabledButton, pressed && seconds === 0 && styles.pressed]}
            >
              <Text style={[styles.destructiveText, seconds > 0 && styles.disabledText]}>
                {seconds > 0 ? `请再想 ${seconds} 秒` : actionLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.76)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 500, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#F1D3D3' },
  warningIcon: { width: 70, height: 70, borderRadius: 23, backgroundColor: C.warning, alignItems: 'center', justifyContent: 'center', marginTop: -64, borderWidth: 7, borderColor: '#FFFFFF' },
  deleteIcon: { backgroundColor: C.danger },
  eyebrow: { color: C.danger, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 17 },
  title: { color: C.ink, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  consequence: { color: C.secondary, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 11, maxWidth: 410 },
  ruleSummary: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F9FC', borderRadius: 12, padding: 13, marginTop: 19 },
  summaryIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#64748B' },
  summaryCopy: { flex: 1 },
  appName: { color: C.ink, fontSize: 14, fontWeight: '800' },
  appMeta: { color: C.secondary, fontSize: 11, marginTop: 4 },
  encouragement: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.primarySoft, borderRadius: 12, padding: 14, marginTop: 13 },
  encouragementText: { flex: 1, color: C.primaryDark, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  cooldownCopy: { color: C.muted, fontSize: 11, marginTop: 16 },
  actions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 12 },
  keepButton: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  keepText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  destructiveButton: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: '#F3B4B4', backgroundColor: '#FFF7F7', alignItems: 'center', justifyContent: 'center' },
  destructiveText: { color: '#D34242', fontSize: 13, fontWeight: '800' },
  disabledButton: { backgroundColor: '#F5F6F8', borderColor: '#E2E5EA' },
  disabledText: { color: C.muted },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }
});
