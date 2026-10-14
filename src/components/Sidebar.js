import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { Icon } from './UI';

export function Sidebar({ active, onChange }) {
  const items = [
    ['home', '首页', 'home-outline', 'home'],
    ['limits', '应用限制', 'shield-checkmark-outline', 'shield-checkmark'],
    ['stats', '使用统计', 'stats-chart-outline', 'stats-chart'],
    ['settings', '设置', 'settings-outline', 'settings']
  ];
  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <Image source={require('../../assets/icon.png')} style={styles.brandIcon} />
        <View><Text style={styles.brandText}>时之界</Text><Text style={styles.brandSub}>把时间留给重要的事</Text></View>
      </View>
      <View style={styles.navList}>
        {items.map(([id, label, icon, activeIcon]) => {
          const selected = active === id;
          return <Pressable key={id} onPress={() => onChange(id)} style={[styles.navItem, selected && styles.navActive]}><Icon name={selected ? activeIcon : icon} size={20} color={selected ? C.primary : C.secondary} /><Text style={[styles.navText, selected && styles.navTextActive]}>{label}</Text></Pressable>;
        })}
      </View>
      <View style={styles.footer}><View style={styles.dot} /><View><Text style={styles.footerTitle}>保护服务运行中</Text><Text style={styles.footerHint}>所有规则已生效</Text></View></View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 224, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: C.line, paddingHorizontal: 18, paddingVertical: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8 },
  brandIcon: { width: 42, height: 42, borderRadius: 13 },
  brandText: { color: C.ink, fontWeight: '800', fontSize: 18 },
  brandSub: { color: C.muted, fontSize: 9, marginTop: 2 },
  navList: { marginTop: 38, gap: 7 },
  navItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, paddingHorizontal: 13 },
  navActive: { backgroundColor: C.primarySoft },
  navText: { color: C.secondary, fontSize: 15, fontWeight: '600' },
  navTextActive: { color: C.primary },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.success },
  footerTitle: { color: C.ink, fontSize: 12, fontWeight: '700' },
  footerHint: { color: C.muted, fontSize: 10, marginTop: 2 }
});
