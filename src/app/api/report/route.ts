import { NextRequest, NextResponse } from 'next/server';
import { computeReportData, writeReportSheet, writeDetailedSheet } from '@/lib/sheets-report';

export async function POST(request: NextRequest) {
  try {
    const { month, year } = await request.json();

    if (!month || !year) {
      return NextResponse.json({ error: 'Укажите month и year' }, { status: 400 });
    }

    const data = await computeReportData(month, year);
    await Promise.all([
      writeReportSheet(month, year, data),
      writeDetailedSheet(month, year, data),
    ]);

    return NextResponse.json({
      success: true,
      message: `Отчёт за ${data.monthName} ${year} сгенерирован`,
      report: {
        month: data.monthName,
        year: data.academicYear,
        group: data.groupName,
        curator: data.curator,
        subjects: data.subjects,
        subjectHours: data.subjectHours,
        totalHours: data.totalHours,
        rows: data.reportRows,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Report API error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
