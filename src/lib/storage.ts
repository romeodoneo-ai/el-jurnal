import { DayAttendance, SheetsConfig } from './types';

const STORAGE_KEY = 'el-jurnal-attendance';
const CONFIG_CACHE_KEY = 'el-jurnal-config-cache';

// --- localStorage helpers ---

function getAllData(): Record<string, DayAttendance> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllData(data: Record<string, DayAttendance>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- Attendance CRUD ---

export function getDayAttendance(date: string): DayAttendance | null {
  const data = getAllData();
  return data[date] || null;
}

export function saveDayAttendance(day: DayAttendance) {
  const data = getAllData();
  data[day.date] = day;
  saveAllData(data);
}

export function getFilledDates(): string[] {
  const data = getAllData();
  return Object.keys(data).sort();
}

// --- Config cache (from API) ---

export function cacheConfig(config: SheetsConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
}

export function getCachedConfig(): SheetsConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- Export to CSV ---

export function exportReportCSV(report: {
  subjects: string[];
  subjectHours: Record<string, number>;
  totalHours: number;
  rows: { studentName: string; bySubject: Record<string, number>; total: number; excused: number; totalPercent: string; unexcusedPercent: string }[];
}): string {
  const header = ['№', 'ФИО студента', ...report.subjects, 'ИТОГО', 'Из них по уважит.', '% пропусков', '% неуважит. проп.'];
  const hoursRow = ['', 'Кол. часов', ...report.subjects.map((s) => String(report.subjectHours[s])), String(report.totalHours), '', '', ''];
  const dataRows = report.rows.map((row, i) => [
    String(i + 1), row.studentName,
    ...report.subjects.map((s) => String(row.bySubject[s] || '')),
    String(row.total), String(row.excused), row.totalPercent, row.unexcusedPercent,
  ]);
  return [header, hoursRow, ...dataRows].map((r) => r.join(',')).join('\n');
}
