import { NextRequest, NextResponse } from 'next/server';
import { getFormattedValues, updateValues } from '@/lib/google-sheets';
import { getSheetNames, MAIN_SHEET, colToLetter, HOURS_PER_PAIR, findLastStudentRow } from '@/lib/sheets-config';
import { AttendanceStatus, PairAttendance } from '@/lib/types';

// Find column index (1-based) for a date in the header row
async function findDateCol(sheetName: string, day: number, month: number): Promise<number | null> {
  const row = await getFormattedValues(`'${sheetName}'!G1:ZZ1`);
  if (!row[0]) return null;
  const target = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
  for (let i = 0; i < row[0].length; i++) {
    if (String(row[0][i]).trim() === target) {
      return i + MAIN_SHEET.DATA_START_COL; // 1-based
    }
  }
  return null;
}

// GET: read attendance for a date
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  try {
    const [y, m, d] = date.split('-').map(Number);
    const { main: sheetName } = getSheetNames(m, y % 100);
    const startCol = await findDateCol(sheetName, d, m);

    if (startCol === null) {
      return NextResponse.json({ date, pairs: [], pairCount: 0 });
    }

    const sc = colToLetter(startCol);
    const ec = colToLetter(startCol + MAIN_SHEET.PAIRS_PER_DATE - 1);

    // Read student IDs + names to detect actual row count
    const idValsAll = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
    );
    const endRow = findLastStudentRow(idValsAll);

    // Read subjects (row 3) and student data in parallel
    const [subjectVals, idVals, dataVals] = await Promise.all([
      getFormattedValues(`'${sheetName}'!${sc}3:${ec}3`),
      getFormattedValues(`'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:A${endRow}`),
      getFormattedValues(`'${sheetName}'!${sc}${MAIN_SHEET.STUDENTS_START_ROW}:${ec}${endRow}`),
    ]);

    const subjects = subjectVals[0] || [];
    const studentIds = idVals.map((r) => parseInt(String(r[0])));

    // Auto-detect pair count from subjects
    let pairCount = 0;
    for (let i = 0; i < MAIN_SHEET.PAIRS_PER_DATE; i++) {
      if (subjects[i] && String(subjects[i]).trim()) pairCount = i + 1;
    }

    const pairs: PairAttendance[] = [];
    for (let p = 0; p < MAIN_SHEET.PAIRS_PER_DATE; p++) {
      const subject = subjects[p] ? String(subjects[p]).trim() : '';
      const attendance: Record<number, AttendanceStatus> = {};

      for (let s = 0; s < studentIds.length; s++) {
        const sid = studentIds[s];
        if (!sid) continue;
        const val = String(dataVals[s]?.[p] || '').trim().toUpperCase();
        if (val === 'Н' || val === 'У') {
          attendance[sid] = val as AttendanceStatus;
        }
      }

      pairs.push({ pairNumber: p + 1, subject, attendance });
    }

    return NextResponse.json({ date, pairs, pairCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Attendance GET error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: write attendance for a date
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, pairs } = body;
    const [y, m, d] = date.split('-').map(Number);
    const { main: sheetName } = getSheetNames(m, y % 100);

    const startCol = await findDateCol(sheetName, d, m);
    if (startCol === null) {
      return NextResponse.json({ error: `Дата не найдена в листе ${sheetName}` }, { status: 404 });
    }

    // Read student IDs + names for row mapping (detect actual count)
    const idValsAll = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
    );
    const endRow = findLastStudentRow(idValsAll);
    const idVals = idValsAll.slice(0, endRow - MAIN_SHEET.STUDENTS_START_ROW + 1);
    const studentIds = idVals.map((r) => parseInt(String(r[0])));

    // Build subject row
    const subjectRow: string[] = [];
    for (let p = 0; p < MAIN_SHEET.PAIRS_PER_DATE; p++) {
      const pair = pairs.find((pr: PairAttendance) => pr.pairNumber === p + 1);
      subjectRow.push(pair?.subject || '');
    }

    // Build attendance grid
    const grid: string[][] = [];
    for (let s = 0; s < studentIds.length; s++) {
      const row: string[] = [];
      const sid = studentIds[s];
      for (let p = 0; p < MAIN_SHEET.PAIRS_PER_DATE; p++) {
        const pair = pairs.find((pr: PairAttendance) => pr.pairNumber === p + 1);
        row.push(sid && pair?.attendance[sid] ? pair.attendance[sid] : '');
      }
      grid.push(row);
    }

    const sc = colToLetter(startCol);
    const ec = colToLetter(startCol + MAIN_SHEET.PAIRS_PER_DATE - 1);

    // Write subjects + attendance in parallel
    await Promise.all([
      updateValues(`'${sheetName}'!${sc}3:${ec}3`, [subjectRow]),
      updateValues(
        `'${sheetName}'!${sc}${MAIN_SHEET.STUDENTS_START_ROW}:${ec}${endRow}`,
        grid
      ),
    ]);

    // Update summary columns C-F
    await updateSummary(sheetName, studentIds, endRow);

    return NextResponse.json({ success: true, message: `Сохранено: ${d}.${String(m).padStart(2, '0')}` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Attendance POST error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Recalculate summary columns C-F for each student
async function updateSummary(sheetName: string, studentIds: number[], endRow: number) {
  const allData = await getFormattedValues(
    `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:ZZ${endRow}`
  );

  const summary: (string | number)[][] = [];
  for (let i = 0; i < studentIds.length; i++) {
    if (!studentIds[i]) {
      summary.push(['', '', '', '']);
      continue;
    }
    const row = allData[i] || [];
    let excused = 0;
    let absent = 0;

    for (let col = MAIN_SHEET.DATA_START_COL - 1; col < row.length; col++) {
      const val = String(row[col] || '').trim().toUpperCase();
      if (val === 'Н') absent++;
      else if (val === 'У') excused++;
    }

    summary.push([
      '', // C: Опозданий (not tracked)
      excused * HOURS_PER_PAIR, // D: По уважительной
      absent * HOURS_PER_PAIR,  // E: Пропусков (неуважит.)
      (absent + excused) * HOURS_PER_PAIR, // F: Всего
    ]);
  }

  await updateValues(
    `'${sheetName}'!C${MAIN_SHEET.STUDENTS_START_ROW}:F${endRow}`,
    summary
  );
}
