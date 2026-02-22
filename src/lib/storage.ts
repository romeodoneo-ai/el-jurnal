import { AttendanceStatus, DayAttendance, PairAttendance, MonthReport, ReportRow } from './types';
import { STUDENTS, SUBJECTS, HOURS_PER_PAIR, GROUP_NAME, CURATOR } from './config';

const STORAGE_KEY = 'el-jurnal-attendance';

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

// --- Public API ---

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

export function getMonthDates(year: number, month: number): string[] {
  const data = getAllData();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return Object.keys(data)
    .filter((d) => d.startsWith(prefix))
    .sort();
}

// --- Report generation ---

export function generateMonthReport(year: number, month: number): MonthReport {
  const dates = getMonthDates(year, month);
  const data = getAllData();

  // Count hours per subject in this month
  const subjectHours: Record<string, number> = {};
  SUBJECTS.forEach((s) => (subjectHours[s] = 0));

  // Count absences per student per subject
  const absences: Record<number, Record<string, { total: number; excused: number }>> = {};
  STUDENTS.forEach((st) => {
    absences[st.id] = {};
    SUBJECTS.forEach((s) => {
      absences[st.id][s] = { total: 0, excused: 0 };
    });
  });

  for (const date of dates) {
    const day = data[date];
    if (!day) continue;

    for (const pair of day.pairs) {
      if (!pair.subject) continue;
      subjectHours[pair.subject] = (subjectHours[pair.subject] || 0) + HOURS_PER_PAIR;

      for (const student of STUDENTS) {
        const status = pair.attendance[student.id] || '';
        if (status === 'Н' || status === 'У') {
          absences[student.id][pair.subject].total += HOURS_PER_PAIR;
          if (status === 'У') {
            absences[student.id][pair.subject].excused += HOURS_PER_PAIR;
          }
        }
      }
    }
  }

  const totalHours = Object.values(subjectHours).reduce((a, b) => a + b, 0);

  const rows: ReportRow[] = STUDENTS.map((student) => {
    const bySubject: Record<string, number> = {};
    let total = 0;
    let excused = 0;

    SUBJECTS.forEach((s) => {
      const missed = absences[student.id][s].total;
      bySubject[s] = missed;
      total += missed;
      excused += absences[student.id][s].excused;
    });

    const totalPercent = totalHours > 0 ? `${Math.round((total / totalHours) * 100)}%` : '0%';
    const unexcusedPercent =
      totalHours > 0 ? `${Math.round(((total - excused) / totalHours) * 100)}%` : '0%';

    return {
      studentId: student.id,
      studentName: student.name,
      bySubject,
      total,
      excused,
      totalPercent,
      unexcusedPercent,
    };
  });

  const monthNames = [
    '', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
  ];

  return {
    month: monthNames[month],
    year: `${year}-${year + 1}`,
    group: GROUP_NAME,
    curator: CURATOR,
    subjects: [...SUBJECTS],
    subjectHours,
    totalHours,
    rows,
  };
}

// --- Export to CSV ---

export function exportReportCSV(report: MonthReport): string {
  const header = [
    '№',
    'ФИО студента',
    ...report.subjects,
    'ИТОГО',
    'Из них по уважит.',
    '% пропусков',
    '% неуважит. проп.',
  ];

  const hoursRow = ['', 'Кол. часов', ...report.subjects.map((s) => String(report.subjectHours[s])), String(report.totalHours), '', '', ''];

  const dataRows = report.rows.map((row, i) => [
    String(i + 1),
    row.studentName,
    ...report.subjects.map((s) => String(row.bySubject[s] || '')),
    String(row.total),
    String(row.excused),
    row.totalPercent,
    row.unexcusedPercent,
  ]);

  return [header, hoursRow, ...dataRows].map((row) => row.join(',')).join('\n');
}
