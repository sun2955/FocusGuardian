import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { Button, Icon } from './UI';

export function BlockModal({ visible, application, onClose, onExtend }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const name = application?.name || '该应用';
  const limit = application?.limit || 0;
  const gentle = application?.mode === 'gentle';
  const extensionUsed = (application?.extensionCount || 0) >= 1;

  useEffect(() => {
    if (visible) {
      setConfirming(false);
      setWorking(false);
      setMessage('');
    }
  }, [visible, application?.id]);

  const extend = async () => {
    setWorking(true);
    setMessage('');
    const result = await onExtend?.();
    if (!result?.ok) {
      setMessage(result?.reason || '临时延长失败，请稍后重试');
      setWorking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.badge}><Icon name="shield-checkmark" size={39} color="#FFFFFF" /></View>
          <View style={[styles.appIcon, { backgroundColor: application?.color || '#173A67' }]}><Icon name={application?.icon || 'desktop-outline'} size={31} color="#FFFFFF" /></View>
          <Text style={styles.title}>今日额度已用完</Text>
          <Text style={styles.message}>{name} 今天已使用 <Text style={styles.strong}>{limit} 分钟</Text></Text>
          <Text style={styles.reset}>默认将在明天 00:00 恢复</Text>
          <View style={[styles.quote, confirming && styles.confirmQuote]}><Icon name={confirming ? 'alert-circle' : 'leaf'} size={19} color={confirming ? C.danger : C.warning} /><Text style={[styles.quoteText, confirming && styles.confirmText]}>{confirming ? '确认后只增加 5 分钟，今天不能再次延长。真的需要继续吗？' : '停在这里也是一次选择，把时间留给真正重要的事。'}</Text></View>
          {message ? <Text style={styles.error}>{message}</Text> : null}
          {gentle && !extensionUsed ? (
            <View style={styles.actions}>
              <Button secondary onPress={confirming ? () => setConfirming(false) : onClose} style={styles.action}>{confirming ? '再想想' : '返回工作'}</Button>
              <Button onPress={confirming ? extend : () => setConfirming(true)} style={styles.action}>{working ? '正在延长…' : confirming ? '确认延长5分钟' : '临时延长5分钟'}</Button>
            </View>
          ) : <Button onPress={onClose} style={styles.singleAction}>{extensionUsed ? '今日已延长过，返回工作' : '知道了，返回工作'}</Button>}
          <Text style={styles.modeHint}>{gentle ? '温和模式：每天最多临时延长一次' : '标准模式：额度用完后不提供临时解锁'}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 470, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 30, alignItems: 'center' },
  badge: { width: 76, height: 76, borderRadius: 25, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', marginTop: -67, borderWidth: 7, borderColor: '#FFFFFF' },
  appIcon: { width: 58, height: 58, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  title: { color: C.ink, fontWeight: '900', fontSize: 25, marginTop: 18 },
  message: { color: C.secondary, fontSize: 15, marginTop: 10 },
  strong: { color: C.danger, fontWeight: '800' },
  reset: { color: C.muted, fontSize: 13, marginTop: 7 },
  quote: { width: '100%', borderRadius: 11, backgroundColor: C.warningSoft, padding: 13, marginTop: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmQuote: { backgroundColor: C.dangerSoft }, quoteText: { flex: 1, color: '#97620B', fontSize: 12, lineHeight: 19, fontWeight: '600', textAlign: 'center' }, confirmText: { color: C.danger },
  error: { color: C.danger, fontSize: 11, marginTop: 10 },
  actions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 22 }, action: { flex: 1 }, singleAction: { width: '100%', marginTop: 22 },
  modeHint: { color: C.muted, fontSize: 10, marginTop: 12 }
});
