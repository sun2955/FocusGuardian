import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors as C } from './src/theme';
import { Sidebar } from './src/components/Sidebar';
import { BlockModal } from './src/components/BlockModal';
import { HomeScreen } from './src/screens/HomeScreen';
import { LimitsScreen } from './src/screens/LimitsScreen';
import { RuleScreen } from './src/screens/RuleScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { applications as defaultApplications } from './src/data';
import { getDateKey } from './src/usage';

const STORAGE_KEY = 'focus-guardian.applications';
const HISTORY_STORAGE_KEY = 'focus-guardian.usage-history';
const SETTINGS_STORAGE_KEY = 'focus-guardian.settings';
const DEFAULT_SETTINGS = { startup: false, idle: true, reset: true, clock: true };

function loadSettings() {
  try {
    const saved = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function normalizeApplications(parsed, settings = DEFAULT_SETTINGS) {
    const today = new Date();
    const dateKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    return (Array.isArray(parsed) ? parsed : []).filter((item) => item.path).map((item) => {
      const normalized = { ...item, category: item.category || '其他' };
      if (normalized.usageDate === dateKey) return { ...normalized, quotaUsedSeconds: Number(normalized.quotaUsedSeconds ?? normalized.usedSeconds ?? 0) || 0 };
      return {
        ...normalized,
        used: 0,
        usedSeconds: 0,
        quotaUsedSeconds: settings.reset ? 0 : Math.max(0, Number(normalized.quotaUsedSeconds ?? normalized.usedSeconds ?? Number(normalized.used || 0) * 60) || 0),
        usageDate: dateKey,
        status: '尚未使用',
        extraSeconds: 0,
        extensionCount: 0,
        extensionDate: null
      };
    });
}

function loadApplications(settings = DEFAULT_SETTINGS) {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return normalizeApplications(saved ? JSON.parse(saved) : defaultApplications, settings);
  } catch {
    return defaultApplications;
  }
}

function loadUsageHistory() {
  try {
    const saved = globalThis.localStorage?.getItem(HISTORY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = getDateKey(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
    return parsed.filter((record) => record?.date >= cutoff && record?.appId);
  } catch {
    return [];
  }
}

export default function App() {
  const [active, setActive] = useState('home');
  const [ruleEditor, setRuleEditor] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [applications, setApplications] = useState(() => loadApplications(settings));
  const [usageHistory, setUsageHistory] = useState(loadUsageHistory);
  const [storageReady, setStorageReady] = useState(false);
  const applicationsRef = useRef(applications);
  const { width } = useWindowDimensions();
  const compact = width < 930;

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      if (!globalThis.focusGuardian?.hydrateStorage) {
        if (active) setStorageReady(true);
        return;
      }
      try {
        const state = await globalThis.focusGuardian.hydrateStorage({ settings, applications, usageHistory });
        if (!active) return;
        const hydratedSettings = { ...DEFAULT_SETTINGS, ...(state?.settings || {}) };
        const cutoff = getDateKey(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
        setSettings(hydratedSettings);
        setApplications(normalizeApplications(state?.applications || [], hydratedSettings));
        setUsageHistory((Array.isArray(state?.usageHistory) ? state.usageHistory : []).filter((record) => record?.date >= cutoff && record?.appId));
      } catch {
        // Continue with the legacy local data if SQLite cannot be read.
      } finally {
        if (active) setStorageReady(true);
      }
    };
    hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      globalThis.focusGuardian?.updateSettings?.(settings).catch(() => {});
      globalThis.focusGuardian?.saveSettings?.(settings).catch(() => {});
    } catch {
      // Keep the current session settings when persistent storage is unavailable.
    }
  }, [settings, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    applicationsRef.current = applications;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(applications));
      globalThis.focusGuardian?.saveApplications?.(applications).catch(() => {});
      globalThis.focusGuardian?.syncLimitRules?.(applications).catch(() => {});
    } catch {
      // The in-memory rules still work if storage is unavailable.
    }
  }, [applications, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      globalThis.localStorage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify(usageHistory));
      globalThis.focusGuardian?.saveUsageHistory?.(usageHistory).catch(() => {});
    } catch {
      // History remains available in memory if local storage is unavailable.
    }
  }, [usageHistory, storageReady]);

  useEffect(() => {
    const removeUsageListener = globalThis.focusGuardian?.onLimitUsage?.((updates) => {
      setApplications((current) => {
        let changed = false;
        const next = current.map((application) => {
          const update = updates.find((item) => item.id === application.id);
          if (!update) return application;
          const hasChange = Object.keys(update).some((key) => application[key] !== update[key]);
          if (!hasChange) return application;
          changed = true;
          return { ...application, ...update };
        });
        return changed ? next : current;
      });
      setUsageHistory((current) => {
        const next = [...current];
        let changed = false;
        updates.forEach((update) => {
          if (!update.usageDate) return;
          const application = applicationsRef.current.find((item) => item.id === update.id);
          if (!application) return;
          const index = next.findIndex((record) => record.date === update.usageDate && record.appId === update.id);
          const record = {
            date: update.usageDate,
            appId: update.id,
            name: application.name,
            category: application.category || '其他',
            icon: application.icon || 'desktop-outline',
            color: application.color || '#64748B',
            limit: application.limit,
            usedSeconds: Math.max(0, Number(update.usedSeconds) || 0)
          };
          if (index === -1) {
            next.push(record);
            changed = true;
          } else {
            const existing = next[index];
            const merged = { ...existing, ...record, usedSeconds: Math.max(existing.usedSeconds || 0, record.usedSeconds) };
            if (existing.usedSeconds !== merged.usedSeconds || existing.name !== merged.name || existing.category !== merged.category || existing.icon !== merged.icon || existing.color !== merged.color || existing.limit !== merged.limit) {
              next[index] = merged;
              changed = true;
            }
          }
        });
        const cutoff = getDateKey(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
        const filtered = next.filter((record) => record.date >= cutoff);
        if (filtered.length !== next.length) changed = true;
        return changed ? filtered : current;
      });
    });
    const removeBlockedListener = globalThis.focusGuardian?.onApplicationBlocked?.((application) => {
      setBlocked(application);
    });
    return () => {
      removeUsageListener?.();
      removeBlockedListener?.();
    };
  }, []);

  const saveRule = (rule) => {
    setApplications((current) => {
      const index = current.findIndex((item) => item.id === rule.id);
      if (index === -1) return [...current, rule];
      return current.map((item) => item.id === rule.id ? { ...item, ...rule } : item);
    });
    setRuleEditor(null);
    setActive('limits');
  };

  const toggleRule = (id) => {
    setApplications((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (item.enabled === false) {
        return { ...item, enabled: true, status: item.activeStatus || '尚未使用', activeStatus: undefined };
      }
      return { ...item, enabled: false, activeStatus: item.status, status: '已暂停' };
    }));
  };

  const deleteRule = (id) => {
    setApplications((current) => current.filter((item) => item.id !== id));
  };

  const extendLimit = async (application) => {
    try {
      const result = await globalThis.focusGuardian?.extendLimit?.(application.id);
      if (!result?.ok) return result || { ok: false, reason: '当前环境无法延长额度' };
      setApplications((current) => current.map((item) => item.id === application.id ? {
        ...item,
        extraSeconds: result.extraSeconds,
        extensionDate: result.extensionDate,
        extensionCount: result.extensionCount,
        status: '已延长5分钟'
      } : item));
      setBlocked(null);
      return result;
    } catch {
      return { ok: false, reason: '临时延长失败，请稍后重试' };
    }
  };

  const content = useMemo(() => {
    if (ruleEditor !== null) return <RuleScreen applications={applications} initialRule={ruleEditor.id ? ruleEditor : null} onDone={() => setRuleEditor(null)} onSave={saveRule} />;
    if (active === 'limits') return <LimitsScreen applications={applications} onCreate={() => setRuleEditor({})} onEdit={setRuleEditor} onBlock={() => setBlocked({ name: '示例应用', limit: 60 })} onToggle={toggleRule} onDelete={deleteRule} />;
    if (active === 'stats') return <StatsScreen applications={applications} usageHistory={usageHistory} />;
    if (active === 'settings') return <SettingsScreen values={settings} onChange={setSettings} applications={applications} usageHistory={usageHistory} />;
    return <HomeScreen applications={applications} usageHistory={usageHistory} onCreate={() => setRuleEditor({})} />;
  }, [active, applications, ruleEditor, settings, usageHistory]);

  const navigate = (page) => {
    setRuleEditor(null);
    setActive(page);
  };

  return (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      {!compact ? <Sidebar active={active} onChange={navigate} /> : null}
      <View style={styles.main}>
        {compact ? (
          <View style={styles.compactNav}>
            {[
              ['home', 'home'],
              ['limits', 'shield-checkmark'],
              ['stats', 'stats-chart'],
              ['settings', 'settings']
            ].map(([id, icon]) => (
              <Pressable key={id} onPress={() => navigate(id)} style={[styles.compactItem, active === id && styles.compactActive]}>
                <Ionicons name={icon} size={20} color={active === id ? C.primary : C.secondary} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {content}
      </View>
      <BlockModal visible={Boolean(blocked)} application={blocked} onClose={() => setBlocked(null)} onExtend={() => extendLimit(blocked)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: '100%', flexDirection: 'row', backgroundColor: C.canvas },
  main: { flex: 1, minWidth: 0 },
  compactNav: { height: 58, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  compactItem: { width: 54, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  compactActive: { backgroundColor: C.primarySoft }
});
