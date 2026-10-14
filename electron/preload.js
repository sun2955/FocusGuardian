'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusGuardian', {
  getRunningApplications: () => ipcRenderer.invoke('processes:list'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  hydrateStorage: (fallback) => ipcRenderer.invoke('storage:hydrate', fallback),
  saveSettings: (settings) => ipcRenderer.invoke('storage:save-settings', settings),
  saveApplications: (applications) => ipcRenderer.invoke('storage:save-applications', applications),
  saveUsageHistory: (history) => ipcRenderer.invoke('storage:save-history', history),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  exportUsageData: (payload) => ipcRenderer.invoke('data:export', payload),
  syncLimitRules: (rules) => ipcRenderer.invoke('limits:sync', rules),
  extendLimit: (id) => ipcRenderer.invoke('limits:extend', id),
  getLimitDebug: () => ipcRenderer.invoke('limits:debug'),
  onLimitUsage: (callback) => {
    const listener = (_event, updates) => callback(updates);
    ipcRenderer.on('limits:usage', listener);
    return () => ipcRenderer.removeListener('limits:usage', listener);
  },
  onApplicationBlocked: (callback) => {
    const listener = (_event, application) => callback(application);
    ipcRenderer.on('limits:blocked', listener);
    return () => ipcRenderer.removeListener('limits:blocked', listener);
  }
});
