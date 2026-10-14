const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function getDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

export function getDateByOffset(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

export function buildDailyUsage(history, count, endOffset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const offset = endOffset - (count - 1 - index);
    const date = getDateByOffset(offset);
    const dateKey = getDateKey(date);
    const seconds = history
      .filter((record) => record.date === dateKey)
      .reduce((total, record) => total + Math.max(0, Number(record.usedSeconds) || 0), 0);
    return {
      date: dateKey,
      day: count === 1 ? '今天' : DAY_NAMES[date.getDay()],
      shortDate: `${date.getMonth() + 1}/${date.getDate()}`,
      seconds,
      value: seconds / 3600
    };
  });
}

export function formatDuration(seconds, compact = false) {
  const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return compact ? `${minutes}分` : `${minutes}分钟`;
  if (minutes === 0) return compact ? `${hours}时` : `${hours}小时`;
  return compact ? `${hours}时${minutes}分` : `${hours}小时${minutes}分`;
}

export function calculateChange(currentSeconds, previousSeconds) {
  if (previousSeconds <= 0) return currentSeconds > 0 ? null : 0;
  return Math.round(((currentSeconds - previousSeconds) / previousSeconds) * 100);
}
