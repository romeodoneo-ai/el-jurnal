import { getFormattedValues, updateValues, clearRange, getSheetId, batchUpdate, ensureSheet } from './google-sheets';
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

/** Read settings (group name, curator) from the "Настройки" sheet if it exists. */
async function readSettings(): Promise<{ groupName?: string; curator?: string; academicYear?: string }> {
  try {
    const data = await getFormattedValues("'Настройки'!A1:B3");
    return {
      groupName: data[0]?.[1] || undefined,
      curator: data[1]?.[1] || undefined,
      academicYear: data[2]?.[1] || undefined,
    };
  } catch {
    return {};
  }
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

  // Read header + subject row + all student data + settings in parallel
  const [headerVals, subjectVals, allData, settings] = await Promise.all([
    getFormattedValues(`'${sheetName}'!A1:ZZ1`),
    getFormattedValues(`'${sheetName}'!A3:ZZ3`),
    getFormattedValues(`'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:ZZ${endRow}`),
    readSettings(),
  ]);

  const groupName = settings.groupName || String(headerVals[0]?.[0] || 'СИС-12').trim();
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

  const computedYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  const academicYear = settings.academicYear || computedYear;

  // Curator from settings or from existing report sheet
  let curator = settings.curator || '';
  if (!curator) {
    try {
      const reportSheetName = getSheetNames(month, year % 100).report;
      const rh = await getFormattedValues(`'${reportSheetName}'!A1`);
      const m = String(rh[0]?.[0] || '').match(/Куратор\s*[-–—]\s*(.+)/);
      if (m) curator = m[1].trim();
    } catch { /* sheet may not exist yet */ }
  }

  return {
    students, subjects, subjectHours, totalHours,
    reportRows, detailedRows, groupName,
    curator: curator || 'Куратор',
    monthName: MONTH_NAMES[month],
    academicYear,
  };
}

// --- Formatting helpers ---

const THIN_BORDER: sheets_v4.Schema$Border = {
  style: 'SOLID',
  color: { red: 0, green: 0, blue: 0, alpha: 1 },
};

/**
 * Write the "Отчет" sheet.
 *
 * Layout:
 *   Rows 1-2: Title (merged across full width)
 *   Rows 3-6: Header (merged vertically per column — subject names, ИТОГО, etc.)
 *   Row 7:    Hours per subject
 *   Rows 8+:  Student data
 *
 * Formatting:
 *   - Title merged across all columns
 *   - Header cells: centered, wrapped, NOT bold, NOT rotated
 *   - Thin (1px) borders from row 3 to end
 */
export async function writeReportSheet(month: number, year: number, data: ReportData) {
  const { report: name } = getSheetNames(month, year % 100);
  const { students, subjects, subjectHours, totalHours, reportRows, groupName, curator, monthName, academicYear } = data;

  try { await clearRange(`'${name}'!A1:ZZ200`); } catch { /* sheet may not exist */ }

  const rows: unknown[][] = [];

  // Row 1: Title (row 2 will be empty but merged with row 1)
  rows.push([
    `Анализ посещаемости занятий в группе ${groupName}  за ${monthName} месяц   ${academicYear}  уч.года\nКуратор - ${curator}`,
  ]);

  // Row 2: empty (merged with row 1)
  rows.push([]);

  // Row 3: header values (each column will be merged rows 3-6)
  rows.push([
    '№',
    'Предмет,\nкол. час\nФИО\nстудента',
    ...subjects,
    'ИТОГО',
    'Из них по\nуважит.',
    '% пропусков',
    '% неуважит.\nпроп.',
  ]);

  // Rows 4-6: empty (covered by merged cells)
  rows.push([]);
  rows.push([]);
  rows.push([]);

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

  const endCol = 2 + subjects.length + 4;
  const endRow = 7 + students.length;
  await updateValues(`'${name}'!A1:${colToLetter(endCol)}${endRow}`, rows);

  // --- Formatting ---
  try {
    const sheetId = await getSheetId(name);

    // Step 1: Unmerge + clear old formatting (prevents stale % format leaking to hours cells)
    try {
      await batchUpdate([
        { unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 50 } } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 50 }, cell: {}, fields: 'userEnteredFormat' } },
      ]);
    } catch { /* ok */ }

    // Re-write values after clearing format (USER_ENTERED sets correct format per cell)
    await updateValues(`'${name}'!A1:${colToLetter(endCol)}${endRow}`, rows);

    // Step 2: Apply formatting
    const requests: sheets_v4.Schema$Request[] = [];

    // Merge rows 1-2 for title across full table width
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: endCol },
        mergeType: 'MERGE_ALL',
      },
    });

    // Title formatting: wrap, center, middle
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: endCol },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: { bold: false },
          },
        },
        fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy,userEnteredFormat.textFormat.bold',
      },
    });

    // Merge header cells rows 3-6 (0-indexed 2-5) for each column
    for (let col = 0; col < endCol; col++) {
      requests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: 2, endRowIndex: 6, startColumnIndex: col, endColumnIndex: col + 1 },
          mergeType: 'MERGE_ALL',
        },
      });
    }

    // Header formatting: center, middle, wrap, NOT bold, NOT rotated
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: endCol },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
            wrapStrategy: 'WRAP',
            textFormat: { bold: false },
            textRotation: { angle: 0 },
          },
        },
        fields: 'userEnteredFormat.verticalAlignment,userEnteredFormat.horizontalAlignment,userEnteredFormat.wrapStrategy,userEnteredFormat.textFormat.bold,userEnteredFormat.textRotation',
      },
    });

    // Set reasonable width for subject columns so names wrap nicely (not look rotated)
    if (subjects.length > 0) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 2 + subjects.length },
          properties: { pixelSize: 85 },
          fields: 'pixelSize',
        },
      });
    }

    // Data area: NOT bold
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 6, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: endCol },
        cell: { userEnteredFormat: { textFormat: { bold: false } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    });

    // Thin borders from row 3 to end
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: endCol },
        top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
        innerHorizontal: THIN_BORDER, innerVertical: THIN_BORDER,
      },
    });

    await batchUpdate(requests);
  } catch { /* formatting is non-critical */ }
}

/**
 * Write the "Подробно" sheet.
 *
 * Layout:
 *   Row 1: Subject headers (each spans 3 columns: Ч, Н, У) + merged №, ФИО
 *   Row 2: Sub-headers — Ч, Н, У for each subject
 *   Rows 3+: Student data
 *   Last row: Total hours (B = grand total, subject Ч cols = per-subject)
 *
 * Formatting:
 *   - Student A+B cells: dark blue bg, white text
 *   - Total A+B cells: light gray bg, black text
 *   - All text NOT bold
 *   - Thin borders from row 1 to end
 */
export async function writeDetailedSheet(month: number, year: number, data: ReportData) {
  const { detailed: name } = getSheetNames(month, year % 100);
  const { subjects, detailedRows } = data;

  try { await clearRange(`'${name}'!A1:BZ200`); } catch { /* sheet may not exist */ }

  const rows: unknown[][] = [];

  // Row 1: subject group headers (each subject spans 3 cols)
  const h1: unknown[] = ['№', 'ФИО'];
  for (const s of subjects) { h1.push(s, '', ''); }
  rows.push(h1);

  // Row 2: sub-headers
  const h2: unknown[] = ['', ''];
  for (let i = 0; i < subjects.length; i++) { h2.push('Ч', 'Н', 'У'); }
  rows.push(h2);

  // Rows 3+: student data
  for (let i = 0; i < detailedRows.length; i++) {
    const dr = detailedRows[i];
    const row: unknown[] = [i + 1, dr.studentName];
    for (const s of subjects) {
      const d = dr.bySubject[s];
      row.push(d.hours || '', d.unexcused || '', d.excused || '');
    }
    rows.push(row);
  }

  // Total hours row: B = grand total, subject Ч columns = per-subject hours
  const hoursRow: unknown[] = ['', data.totalHours];
  for (const s of subjects) { hoursRow.push(data.subjectHours[s] || 0, '', ''); }
  rows.push(hoursRow);

  const endCol = 2 + subjects.length * 3;
  const endRow = 2 + detailedRows.length + 1; // 2 headers + students + 1 totals
  await updateValues(`'${name}'!A1:${colToLetter(endCol)}${endRow}`, rows);

  // --- Formatting ---
  try {
    const sheetId = await getSheetId(name);

    // Step 1: Unmerge + clear old formatting
    try {
      await batchUpdate([
        { unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 100 } } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 100 }, cell: {}, fields: 'userEnteredFormat' } },
      ]);
    } catch { /* ok */ }

    // Re-write values after clearing format
    await updateValues(`'${name}'!A1:${colToLetter(endCol)}${endRow}`, rows);

    const requests: sheets_v4.Schema$Request[] = [];

    // Merge A1:A2 (№) and B1:B2 (ФИО)
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
        mergeType: 'MERGE_ALL',
      },
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 },
        mergeType: 'MERGE_ALL',
      },
    });

    // Merge subject name cells in row 1 (each subject spans 3 columns)
    for (let i = 0; i < subjects.length; i++) {
      const sc = 2 + i * 3;
      requests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: sc, endColumnIndex: sc + 3 },
          mergeType: 'MERGE_ALL',
        },
      });
    }

    // All text NOT bold for entire table
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: endCol },
        cell: { userEnteredFormat: { textFormat: { bold: false } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    });

    // Center + middle-align headers (rows 1-2)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: endCol },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: false },
          },
        },
        fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.textFormat.bold',
      },
    });

    // Student rows: columns A+B — dark blue bg, white text
    const studentStart = 2; // row 3 (0-indexed)
    const studentEnd = 2 + detailedRows.length;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: studentStart, endRowIndex: studentEnd, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.17, green: 0.34, blue: 0.6 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: false },
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat',
      },
    });

    // Total row: columns A+B — light gray bg, black text
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: studentEnd, endRowIndex: studentEnd + 1, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 }, bold: false },
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat',
      },
    });

    // Thin borders from row 1 to end
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: endCol },
        top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
        innerHorizontal: THIN_BORDER, innerVertical: THIN_BORDER,
      },
    });

    await batchUpdate(requests);
  } catch { /* formatting is non-critical */ }
}
