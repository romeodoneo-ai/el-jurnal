import { NextRequest, NextResponse } from 'next/server';
import { getFormattedValues, updateValues, clearRange } from '@/lib/google-sheets';
import { MAIN_SHEET, findSubjectList, sortSheetsByDate } from '@/lib/sheets-config';
import { listSheetNames } from '@/lib/google-sheets';

async function getLatestSheet(): Promise<string> {
  const sheetNames = await listSheetNames();
  const mainSheets = sortSheetsByDate(sheetNames.filter((n) => /^\d{2}\.\d{2}$/.test(n)));
  if (mainSheets.length === 0) throw new Error('Листы не найдены');
  return mainSheets[mainSheets.length - 1];
}

// GET: read the master subject list from the sheet
export async function GET() {
  try {
    const sheetName = await getLatestSheet();
    const allData = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
    );
    const { subjects } = findSubjectList(allData);
    return NextResponse.json({ subjects });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT: update the master subject list in the sheet
export async function PUT(request: NextRequest) {
  try {
    const { subjects } = await request.json() as { subjects: string[] };
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json({ error: 'Список предметов пуст' }, { status: 400 });
    }

    const sheetName = await getLatestSheet();
    const allData = await getFormattedValues(
      `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
    );
    const { startRow, subjects: oldSubjects } = findSubjectList(allData);

    // Clear old subject list
    if (oldSubjects.length > 0) {
      const oldEndRow = startRow + oldSubjects.length - 1;
      await clearRange(`'${sheetName}'!A${startRow}:B${oldEndRow}`);
    }

    // Write new subject list
    const rows = subjects.map((s, i) => [i + 1, s]);
    const newEndRow = startRow + subjects.length - 1;
    await updateValues(`'${sheetName}'!A${startRow}:B${newEndRow}`, rows);

    return NextResponse.json({ success: true, subjects });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
