import { NextRequest, NextResponse } from 'next/server';
import { getFormattedValues, updateValues, listSheetNames, getSheetId, insertRows, deleteRows } from '@/lib/google-sheets';
import { MAIN_SHEET, findLastStudentRow, sortSheetsByDate } from '@/lib/sheets-config';

async function getLatestSheet(): Promise<string> {
  const sheetNames = await listSheetNames();
  const mainSheets = sortSheetsByDate(sheetNames.filter((n) => /^\d{2}\.\d{2}$/.test(n)));
  if (mainSheets.length === 0) throw new Error('Листы не найдены');
  return mainSheets[mainSheets.length - 1];
}

async function readStudents(sheetName: string) {
  const data = await getFormattedValues(
    `'${sheetName}'!A${MAIN_SHEET.STUDENTS_START_ROW}:B${MAIN_SHEET.STUDENTS_MAX_ROW}`
  );
  const endRow = findLastStudentRow(data);
  const students = data
    .slice(0, endRow - MAIN_SHEET.STUDENTS_START_ROW + 1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({ id: parseInt(String(r[0])), name: String(r[1]).trim() }));
  return { students, endRow };
}

// GET: read student list
export async function GET() {
  try {
    const sheetName = await getLatestSheet();
    const { students } = await readStudents(sheetName);
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

// POST: add a new student
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json() as { name: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Укажите имя студента' }, { status: 400 });
    }

    const sheetName = await getLatestSheet();
    const { students, endRow } = await readStudents(sheetName);

    // Insert a new row after the last student (0-based index for API)
    const sheetId = await getSheetId(sheetName);
    const insertIdx = endRow; // 0-based: endRow is 1-based last student row, so 0-based = endRow
    await insertRows(sheetId, insertIdx, 1);

    // Write new student: number = count + 1, name
    const newId = students.length + 1;
    const newRow = endRow + 1; // 1-based row number (after insert, the new empty row is here)
    await updateValues(`'${sheetName}'!A${newRow}:B${newRow}`, [[newId, name.trim()]]);

    // Re-read and return updated list
    const { students: updated } = await readStudents(sheetName);
    return NextResponse.json({ success: true, students: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: remove a student by ID
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json() as { id: number };
    if (!id) {
      return NextResponse.json({ error: 'Укажите id студента' }, { status: 400 });
    }

    const sheetName = await getLatestSheet();
    const { students } = await readStudents(sheetName);

    // Find which row to delete (0-based index in students array → sheet row)
    const idx = students.findIndex((s) => s.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Студент не найден' }, { status: 404 });
    }

    const sheetId = await getSheetId(sheetName);
    const rowIndex = MAIN_SHEET.STUDENTS_START_ROW - 1 + idx; // 0-based for API
    await deleteRows(sheetId, rowIndex, 1);

    // Re-number remaining students (1, 2, 3, ...)
    const { students: remaining, endRow } = await readStudents(sheetName);
    if (remaining.length > 0) {
      const renumbered = remaining.map((s, i) => [i + 1, s.name]);
      const startRow = MAIN_SHEET.STUDENTS_START_ROW;
      await updateValues(`'${sheetName}'!A${startRow}:B${startRow + remaining.length - 1}`, renumbered);
    }

    const { students: updated } = await readStudents(sheetName);
    return NextResponse.json({ success: true, students: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
