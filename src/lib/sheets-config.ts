// Sheet naming: "MM.YY", "MM.YYПодробно", "MM.YYОтчет"
export function getSheetNames(month: number, yearShort: number) {
  const mm = String(month).padStart(2, '0');
  const yy = String(yearShort).padStart(2, '0');
  return {
    main: `${mm}.${yy}`,
    detailed: `${mm}.${yy}Подробно`,
    report: `${mm}.${yy}Отчет`,
  };
}

export const MAIN_SHEET = {
  SUBJECT_ROW: 3,
  STUDENTS_START_ROW: 4,
  STUDENTS_MAX_ROW: 100, // Read up to this row; actual count detected dynamically
  DATA_START_COL: 7, // Column G (1-based)
  PAIRS_PER_DATE: 4,
};

/** Find the last row that contains a student (1-based row number). */
export function findLastStudentRow(idColumn: string[][]): number {
  let lastIdx = 0;
  for (let i = 0; i < idColumn.length; i++) {
    const val = String(idColumn[i]?.[0] || '').trim();
    if (val && !isNaN(Number(val)) && Number(val) > 0) lastIdx = i;
  }
  return MAIN_SHEET.STUDENTS_START_ROW + lastIdx;
}

export const HOURS_PER_PAIR = 2;

export function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c > 0) {
    c--;
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26);
  }
  return result;
}
