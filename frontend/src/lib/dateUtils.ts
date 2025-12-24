import i18n from '../i18n';
import { useLocaleStore, type AppTimezone } from '../stores/localeStore';

function getUiLocale(): 'ja-JP' | 'en-US' {
  const lang = i18n.resolvedLanguage || i18n.language || 'en';
  return lang.toLowerCase().startsWith('ja') ? 'ja-JP' : 'en-US';
}

function getUiTimezone(): AppTimezone {
  return useLocaleStore.getState().timezone;
}

export function formatDateTime(
  date: string | Date,
  options?: { showSeconds?: boolean }
): string {
  const d = new Date(date);
  const locale = getUiLocale();
  const timezone = getUiTimezone();

  return d.toLocaleString(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: options?.showSeconds ? '2-digit' : undefined,
  });
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const locale = getUiLocale();
  const timezone = getUiTimezone();

  return d.toLocaleDateString(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  const locale = getUiLocale();
  const timezone = getUiTimezone();

  return d.toLocaleTimeString(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTimezoneLabel(timezone: AppTimezone = getUiTimezone()): string {
  return timezone === 'Asia/Tokyo' ? 'JST' : 'UTC';
}
