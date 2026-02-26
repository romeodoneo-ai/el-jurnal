import { NextResponse } from 'next/server';
import { getFormattedValues, listSheetNames } from '@/lib/google-sheets';
import { MAIN_SHEET, findLastStudentRow, findSubjectList } from '@/lib/sheets-config';

export async function GET() {
  try {
    const sheetNames = await listSheetNames();
    const mainSheets = sheetNames.filter((n) => /^\d{2}\.\d{2}$/.test(n)).sort();

    if (mainSheets.length === 0) {
      return NextResponse.json({ error: 'Листы не найдены' }, { status: 404 });
    }

    const sheetName = mainSheets[mainSheets.length - 1];

    // Group name from A1
    const header = await getFormattedValues(`'${sheetName}'!A1`);
    const groupName = header[0]?.[0] || 'СИС-12';

    // Students — read a wide range, stop at first gap (before subject list)
    const studentValues = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
    );
    const endRow = findLastStudentRow(studentValues);
    const students = studentValues
      .slice(0, endRow - MAIN_SHEET.STUDENTS_START_ROW + 1)
      .filter((r) => r[0] && r[1])
      .map((r) => ({ id: parseInt(String(r[0])), name: String(r[1]).trim() }));

    // Subjects — master list from below students
    const { subjects: masterSubjects } = findSubjectList(studentValues);

    // Also get subjects from row 3 (already used in schedule) in case some aren't in master list
    const subjectRow = await getFormattedValues(`'${sheetName}'!G3:ZZ3`);
    const subjectSet = new Set<string>(masterSubjects);
    const skipNames = ['Опозданий', 'По уважительной', 'Пропусков'];
    for (const cell of (subjectRow[0] || [])) {
      const s = String(cell || '').trim();
      if (s && !skipNames.includes(s)) subjectSet.add(s);
    }
    const subjects = Array.from(subjectSet);

    // Curator from report sheet header
    const reportSheets = sheetNames.filter((n) => n.endsWith('Отчет'));
    let curator = '';
    if (reportSheets.length > 0) {
      const rh = await getFormattedValues(`'${reportSheets[reportSheets.length - 1]}'!A1`);
      const m = String(rh[0]?.[0] || '').match(/Куратор\s*[-–—]\s*(.+)/);
      if (m) curator = m[1].trim();
    }

    return NextResponse.json({
      groupName,
      students,
      subjects,
      curator: curator || 'Куратор',
      availableMonths: mainSheets,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Config API error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
