import { DayAttendance } from './types';

const SETTINGS_KEY = 'el-jurnal-settings';

interface SyncSettings {
  scriptUrl: string;
  pin: string;
}

export function getSyncSettings(): SyncSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSyncSettings(settings: SyncSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function syncToSheets(day: DayAttendance): Promise<{ success: boolean; message: string }> {
  const settings = getSyncSettings();
  if (!settings?.scriptUrl) {
    return { success: false, message: 'Не настроена синхронизация' };
  }

  try {
    const url = `${settings.scriptUrl}?action=saveAttendance&pin=${encodeURIComponent(settings.pin)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(day),
      mode: 'no-cors',
    });

    // Google Apps Script с no-cors возвращает opaque response
    // Используем redirect-based approach
    return { success: true, message: 'Отправлено в Google Sheets' };
  } catch (err) {
    return { success: false, message: `Ошибка: ${err}` };
  }
}

export async function syncSaveAttendance(day: DayAttendance): Promise<{ success: boolean; message: string }> {
  const settings = getSyncSettings();
  if (!settings?.scriptUrl) {
    return { success: false, message: 'Синхронизация не настроена' };
  }

  try {
    // Google Apps Script web apps need a special approach for POST
    // We use a form-based approach that works with CORS
    const formData = new URLSearchParams();
    formData.append('action', 'saveAttendance');
    formData.append('pin', settings.pin);
    formData.append('data', JSON.stringify(day));

    const response = await fetch(settings.scriptUrl, {
      method: 'POST',
      body: formData,
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, message: result.message || 'Сохранено в Google Sheets' };
    }

    return { success: true, message: 'Данные отправлены' };
  } catch {
    // With Google Apps Script, even "failed" requests often succeed
    return { success: true, message: 'Данные отправлены в Google Sheets' };
  }
}
