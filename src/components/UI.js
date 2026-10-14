import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as C } from '../theme';

export const Icon = ({ name, size = 20, color = C.secondary }) => <Ionicons name={name} size={size} color={color} />;

export function Button({ children, onPress, secondary = false, icon, style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed, style]}>
      {icon ? <Icon name={icon} size={18} color={secondary ? C.primary : '#FFFFFF'} /> : null}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{children}</Text>
    </Pressable>
  );
}

export function StatusPill({ label = '保护中', tone = 'success' }) {
  const palette = tone === 'warning' ? { bg: C.warningSoft, fg: '#B76B00' } : tone === 'danger' ? { bg: C.dangerSoft, fg: '#D94D4D' } : { bg: C.successSoft, fg: '#07895F' };
  return <View style={[styles.pill, { backgroundColor: palette.bg }]}><View style={[styles.dot, { backgroundColor: palette.fg }]} /><Text style={[styles.pillText, { color: palette.fg }]}>{label}</Text></View>;
}

export function ProgressBar({ value, color = C.primary }) {
  return <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} /></View>;
}

export function PageHeader({ title, subtitle, children }) {
  return <View style={styles.header}><View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>{children}</View>;
}

export const uiStyles = StyleSheet.create({
  page: { padding: 30, gap: 22, maxWidth: 1260, width: '100%', alignSelf: 'center' },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '800' },
  sectionHint: { color: C.muted, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, borderRadius: 16 }
});

const styles = StyleSheet.create({
  button: { minHeight: 42, borderRadius: 9, backgroundColor: C.primary, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7DCEA' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondaryText: { color: C.primary },
  pill: { minHeight: 28, borderRadius: 15, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  track: { flex: 1, height: 7, backgroundColor: '#EAECF0', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  title: { color: C.ink, fontWeight: '800', fontSize: 28, letterSpacing: -0.4 },
  subtitle: { color: C.secondary, fontSize: 14, marginTop: 7 }
});
