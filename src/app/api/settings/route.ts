import { NextRequest, NextResponse } from 'next/server';
import { getFormattedValues, updateValues, ensureSheet } from '@/lib/google-sheets';

const SHEET = 'Настройки';

const DEFAULTS = {
  groupName: 'СИС-12',
  curator: 'Куратор',
  academicYear: '2024-2025',
};

export async function GET() {
  try {
    await ensureSheet(SHEET);
    const data = await getFormattedValues(`'${SHEET}'!A1:B3`);
    return NextResponse.json({
      groupName: data[0]?.[1] || DEFAULTS.groupName,
      curator: data[1]?.[1] || DEFAULTS.curator,
      academicYear: data[2]?.[1] || DEFAULTS.academicYear,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { groupName, curator, academicYear } = await request.json();

    await ensureSheet(SHEET);
    await updateValues(`'${SHEET}'!A1:B3`, [
      ['Группа', groupName || DEFAULTS.groupName],
      ['Куратор', curator || DEFAULTS.curator],
      ['Уч. год', academicYear || DEFAULTS.academicYear],
    ]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
