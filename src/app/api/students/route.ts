import { NextRequest, NextResponse } from 'next/server';
import { getFormattedValues, updateValues, listSheetNames } from '@/lib/google-sheets';
import { MAIN_SHEET, findLastStudentRow, sortSheetsByDate } from '@/lib/sheets-config';

async function getLatestSheet(): Promise<string> {
  const sheetNames = await listSheetNames();
  const mainSheets = sortSheetsByDate(sheetNames.filter((n) => /^\d{2}\.\d{2}$/.test(n)));
  if (mainSheets.length === 0) throw new Error('Листы не найдены');
  return mainSheets[mainSheets.length - 1];
}

// GET: read student list
export async function GET() {
  try {
    const sheetName = await getLatestSheet();
    const data = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
    );
    const endRow = findLastStudentRow(data);
    const students = data
      .slice(0, endRow - MAIN_SHEET.STUDENTS_START_ROW + 1)
      .filter((r) => r[0] && r[1])
      .map((r) => ({ id: parseInt(String(r[0])), name: String(r[1]).trim() }));

    return NextResponse.json({ students });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT: rename students (updates names in the latest sheet)
export async function PUT(request: NextRequest) {
  try {
    const { students } = await request.json() as { students: { id: number; name: string }[] };
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Список студентов пуст' }, { status: 400 });
    }

    const sheetName = await getLatestSheet();
    const rows = students.map((s) => [s.id, s.name]);
    const startRow = MAIN_SHEET.STUDENTS_START_ROW;
    const endRow = startRow + students.length - 1;
    await updateValues(`'${sheetName}'!A${startRow}:B${endRow}`, rows);

    return NextResponse.json({ success: true, students });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
