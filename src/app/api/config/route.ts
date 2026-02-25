import { NextResponse } from 'next/server';
import { getFormattedValues, listSheetNames } from '@/lib/google-sheets';
import { MAIN_SHEET } from '@/lib/sheets-config';

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

    // Students from A4:B27
    const studentValues = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_END_ROW}`
    );
    const students = studentValues
      .filter((r) => r[0] && r[1])
      .map((r) => ({ id: parseInt(String(r[0])), name: String(r[1]).trim() }));

    // Subjects from the bottom section (numbered list below students)
    const subjectValues = await getFormattedValues(`'${sheetName}'!A30:B45`);
    const subjects: string[] = [];
    for (const row of subjectValues) {
      if (row[0] && row[1] && /^\d+$/.test(String(row[0]).trim())) {
        subjects.push(String(row[1]).trim());
      }
    }

    const fallbackSubjects = [
      'Математика', 'Физика', 'Литература', 'Русский',
      'История', 'Химия', 'Информатика', 'Иностранный',
    ];

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
      subjects: subjects.length > 0 ? subjects : fallbackSubjects,
      curator: curator || 'Куратор',
      availableMonths: mainSheets,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Config API error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
