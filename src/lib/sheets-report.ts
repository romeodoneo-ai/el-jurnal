import { getFormattedValues, updateValues, clearRange, getSheetId, batchUpdate } from './google-sheets';
import { sheets_v4 } from 'googleapis';
import { getSheetNames, MAIN_SHEET, colToLetter, HOURS_PER_PAIR, findLastStudentRow } from './sheets-config';
import { Student, ReportRow } from './types';

const MONTH_NAMES = [
  '', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export interface ReportData {
  students: Student[];
  subjects: string[];
  subjectHours: Record<string, number>;
  totalHours: number;
  reportRows: ReportRow[];
  detailedRows: {
    studentId: number;
    studentName: string;
    bySubject: Record<string, { hours: number; unexcused: number; excused: number }>;
  }[];
  groupName: string;
  curator: string;
  monthName: string;
  academicYear: string;
}

// Compute all report data from the main attendance sheet
export async function computeReportData(month: number, year: number): Promise<ReportData> {
  const { main: sheetName } = getSheetNames(month, year % 100);

  // Read student IDs to detect actual count
  const idValsAll = await getFormattedValues(
    `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
  );
  const endRow = findLastStudentRow(idValsAll);

  const students: Student[] = idValsAll
    .slice(0, endRow - MAIN_SHEET.STUDENTS_START_ROW + 1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({ id: parseInt(String(r[0])), name: String(r[1]).trim() }));

  // Read header + subject row + all student data
  const [headerVals, subjectVals, allData] = await Promise.all([
    getFormattedValues(`'${sheetName}'!A1:ZZ1`),
    getFormattedValues(`'${sheetName}'!A3:ZZ3`),
    getFormattedValues(`'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:ZZ${endRow}`),
  ]);

  const groupName = String(headerVals[0]?.[0] || 'СИС-12').trim();
  const allSubjects = subjectVals[0] || [];

  // Unique subjects in order
  const subjectSet = new Set<string>();
  for (let i = MAIN_SHEET.DATA_START_COL - 1; i < allSubjects.length; i++) {
    const s = String(allSubjects[i] || '').trim();
    if (s && !['Опозданий', 'По уважительной', 'Пропусков'].includes(s)) {
      subjectSet.add(s);
    }
  }
  const subjects = Array.from(subjectSet);

  // Count hours per subject and absences per student
  const subjectHours: Record<string, number> = {};
  subjects.forEach((s) => (subjectHours[s] = 0));

  const absences: Record<number, Record<string, { total: number; excused: number }>> = {};
  students.forEach((st) => {
    absences[st.id] = {};
    subjects.forEach((s) => (absences[st.id][s] = { total: 0, excused: 0 }));
  });

  for (let col = MAIN_SHEET.DATA_START_COL - 1; col < allSubjects.length; col++) {
    const subj = String(allSubjects[col] || '').trim();
    if (!subj || !subjectSet.has(subj)) continue;

    subjectHours[subj] = (subjectHours[subj] || 0) + HOURS_PER_PAIR;

    for (let row = 0; row < students.length; row++) {
      const st = students[row];
      const val = String(allData[row]?.[col] || '').trim().toUpperCase();
      if (val === 'Н') {
        absences[st.id][subj].total += HOURS_PER_PAIR;
      } else if (val === 'У') {
        absences[st.id][subj].total += HOURS_PER_PAIR;
        absences[st.id][subj].excused += HOURS_PER_PAIR;
      }
    }
  }

  const totalHours = Object.values(subjectHours).reduce((a, b) => a + b, 0);

  const reportRows: ReportRow[] = students.map((st) => {
    const bySubject: Record<string, number> = {};
    let total = 0;
    let excused = 0;
    subjects.forEach((s) => {
      const missed = absences[st.id][s].total;
      bySubject[s] = missed;
      total += missed;
      excused += absences[st.id][s].excused;
    });
    return {
      studentId: st.id,
      studentName: st.name,
      bySubject,
      total,
      excused,
      totalPercent: totalHours > 0 ? `${Math.round((total / totalHours) * 100)}%` : '0%',
      unexcusedPercent: totalHours > 0 ? `${Math.round(((total - excused) / totalHours) * 100)}%` : '0%',
    };
  });

  const detailedRows = students.map((st) => {
    const bySubject: Record<string, { hours: number; unexcused: number; excused: number }> = {};
    subjects.forEach((s) => {
      const a = absences[st.id][s];
      bySubject[s] = { hours: a.total, unexcused: a.total - a.excused, excused: a.excused };
    });
    return { studentId: st.id, studentName: st.name, bySubject };
  });

  const academicYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

  // Read curator from existing report sheet if available
  let curator = '';
  try {
    const reportSheetName = getSheetNames(month, year % 100).report;
    const rh = await getFormattedValues(`'${reportSheetName}'!A1`);
    const m = String(rh[0]?.[0] || '').match(/Куратор\s*[-–—]\s*(.+)/);
    if (m) curator = m[1].trim();
  } catch { /* sheet may not exist yet */ }

  return {
    students, subjects, subjectHours, totalHours,
    reportRows, detailedRows, groupName,
    curator: curator || 'Куратор',
    monthName: MONTH_NAMES[month],
    academicYear,
  };
}

// Write the "Отчет" sheet in the exact format
export async function writeReportSheet(month: number, year: number, data: ReportData) {
  const { report: name } = getSheetNames(month, year % 100);
  const { students, subjects, subjectHours, totalHours, reportRows, groupName, curator, monthName, academicYear } = data;

  try { await clearRange(`'${name}'!A1:Z100`); } catch { /* sheet may not exist */ }

  const rows: unknown[][] = [];

  // Row 1: Title
  rows.push([
    `Анализ посещаемости занятий в группе ${groupName}  за ${monthName} месяц   ${academicYear}  уч.года\nКуратор - ${curator}`,
  ]);

  // Row 2: empty
  rows.push([]);

  // Row 3: header line 1
  rows.push(['№', 'Предмет,', ...subjects.map(() => ''), 'ИТОГО', 'Из них по уважит.', '% пропусков', '% неуважит. проп.']);

  // Row 4: header line 2
  rows.push(['', 'кол. час']);

  // Row 5: header line 3 (subject names)
  rows.push(['', 'ФИО', ...subjects]);

  // Row 6: header line 4
  rows.push(['', 'студента']);

  // Row 7: hours per subject
  rows.push(['', '', ...subjects.map((s) => subjectHours[s] || 0), totalHours, '', '', '']);

  // Rows 8+: student data
  for (let i = 0; i < reportRows.length; i++) {
    const r = reportRows[i];
    rows.push([
      i + 1,
      r.studentName,
      ...subjects.map((s) => r.bySubject[s] || ''),
      r.total || '',
      r.excused || '',
      r.totalPercent,
      r.unexcusedPercent,
    ]);
  }

  const endCol = 2 + subjects.length + 4; // num + name + subjects + 4 summary (ИТОГО, уважит, %, %)
  const endRow = 7 + students.length;
  await updateValues(`'${name}'!A1:${colToLetter(endCol)}${endRow}`, rows);

  // Apply borders to report table
  try {
    const sheetId = await getSheetId(name);
    await applyBorders(sheetId, {
      headerStartRow: 2,  // row 3 (0-indexed)
      headerEndRow: 7,    // after row 7
      dataStartRow: 7,
      dataEndRow: endRow,
      startCol: 0,
      endCol,
    });
  } catch { /* formatting is non-critical */ }
}

// Write the "Подробно" sheet
export async function writeDetailedSheet(month: number, year: number, data: ReportData) {
  const { detailed: name } = getSheetNames(month, year % 100);
  const { subjects, detailedRows } = data;

  try { await clearRange(`'${name}'!A1:BZ100`); } catch { /* sheet may not exist */ }

  const rows: unknown[][] = [];

  // Row 1: subject group headers
  const h1: unknown[] = ['', ''];
  for (const s of subjects) { h1.push(s, '', ''); }
  rows.push(h1);

  // Row 2: sub-headers
  const h2: unknown[] = ['', ''];
  for (let i = 0; i < subjects.length; i++) { h2.push('Ч', 'Н', 'У'); }
  rows.push(h2);

  // Data rows
  for (let i = 0; i < detailedRows.length; i++) {
    const dr = detailedRows[i];
    const row: unknown[] = [i + 1, dr.studentName];
    for (const s of subjects) {
      const d = dr.bySubject[s];
      row.push(d.hours || '', d.unexcused || '', d.excused || '');
    }
    rows.push(row);
  }

  // Hours summary row
  const hoursRow: unknown[] = ['', ''];
  for (const s of subjects) { hoursRow.push(data.subjectHours[s] || 0, '', ''); }
  rows.push(hoursRow);

  const endCol = 2 + subjects.length * 3;
  const endRow = 2 + detailedRows.length + 1;
  await updateValues(`'${name}'!A1:${colToLetter(endCol)}${endRow}`, rows);

  // Apply borders to detailed table
  try {
    const sheetId = await getSheetId(name);
    await applyBorders(sheetId, {
      headerStartRow: 0,
      headerEndRow: 2,
      dataStartRow: 2,
      dataEndRow: endRow,
      startCol: 0,
      endCol,
    });
  } catch { /* formatting is non-critical */ }
}

// --- Border formatting helpers ---

const THICK_BORDER: sheets_v4.Schema$Border = {
  style: 'SOLID_MEDIUM',
  color: { red: 0, green: 0, blue: 0, alpha: 1 },
};

const THIN_BORDER: sheets_v4.Schema$Border = {
  style: 'SOLID',
  color: { red: 0, green: 0, blue: 0, alpha: 1 },
};

interface BorderArea {
  headerStartRow: number; // 0-indexed
  headerEndRow: number;
  dataStartRow: number;
  dataEndRow: number;
  startCol: number;
  endCol: number;
}

async function applyBorders(sheetId: number, area: BorderArea) {
  const requests: sheets_v4.Schema$Request[] = [];

  // Outer border (thick) + inner borders (thin) for entire table
  requests.push({
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: area.headerStartRow,
        endRowIndex: area.dataEndRow,
        startColumnIndex: area.startCol,
        endColumnIndex: area.endCol,
      },
      top: THICK_BORDER,
      bottom: THICK_BORDER,
      left: THICK_BORDER,
      right: THICK_BORDER,
      innerHorizontal: THIN_BORDER,
      innerVertical: THIN_BORDER,
    },
  });

  // Thick border between header and data rows
  requests.push({
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: area.headerEndRow,
        endRowIndex: area.headerEndRow,
        startColumnIndex: area.startCol,
        endColumnIndex: area.endCol,
      },
      top: THICK_BORDER,
    },
  });

  await batchUpdate(requests);
}
