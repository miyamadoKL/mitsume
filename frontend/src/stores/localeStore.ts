import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const detectLanguage = (): 'ja' | 'en' =>
  (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';

// JST/UTC のみ自動判別。ブラウザTZが Asia/Tokyo のときだけ JST、それ以外は UTC。
const detectTimezone = (): 'Asia/Tokyo' | 'UTC' => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz === 'Asia/Tokyo') return 'Asia/Tokyo';
  // フォールバック: JSTはUTC+9なので getTimezoneOffset() は -540
  if (new Date().getTimezoneOffset() === -540) return 'Asia/Tokyo';
  return 'UTC';
};

export type AppLanguage = 'ja' | 'en';
export type AppTimezone = 'Asia/Tokyo' | 'UTC';

interface LocaleState {
  language: AppLanguage;
  timezone: AppTimezone;
  setLanguage: (lang: AppLanguage) => void;
  setTimezone: (tz: AppTimezone) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      language: detectLanguage(),
      timezone: detectTimezone(),
      setLanguage: (language) => set({ language }),
      setTimezone: (timezone) => set({ timezone }),
    }),
    { name: 'locale-storage' }
  )
);
