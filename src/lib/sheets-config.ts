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

/**
 * Find the last row that contains a student (1-based row number).
 * Expects data with columns A and B (number + name).
 * Stops at the first gap (row without both number AND name),
 * so the subject list below students is never included.
 */
export function findLastStudentRow(data: string[][]): number {
  let lastIdx = 0;
  let foundStudent = false;
  for (let i = 0; i < data.length; i++) {
    const num = String(data[i]?.[0] || '').trim();
    const name = String(data[i]?.[1] || '').trim();
    if (num && !isNaN(Number(num)) && Number(num) > 0 && name) {
      lastIdx = i;
      foundStudent = true;
    } else if (foundStudent) {
      break; // first gap after students — stop
    }
  }
  return MAIN_SHEET.STUDENTS_START_ROW + lastIdx;
}

/**
 * Find the subject list below students.
 * After the student block ends, skips empty/partial rows,
 * then finds the next block of "number + text" rows (the subject list).
 * Returns { startRow (1-based), subjects: string[] }.
 */
export function findSubjectList(data: string[][]): { startRow: number; subjects: string[] } {
  // First, skip past students (first block of number+name rows)
  let i = 0;
  let foundStudent = false;
  for (; i < data.length; i++) {
    const num = String(data[i]?.[0] || '').trim();
    const name = String(data[i]?.[1] || '').trim();
    if (num && !isNaN(Number(num)) && Number(num) > 0 && name) {
      foundStudent = true;
    } else if (foundStudent) {
      break; // end of students
    }
  }

  // Now skip the gap (empty or partial rows)
  for (; i < data.length; i++) {
    const num = String(data[i]?.[0] || '').trim();
    const name = String(data[i]?.[1] || '').trim();
    if (num && !isNaN(Number(num)) && Number(num) > 0 && name) {
      break; // found start of subject list
    }
  }

  const startRow = MAIN_SHEET.STUDENTS_START_ROW + i;
  const subjects: string[] = [];

  for (; i < data.length; i++) {
    const num = String(data[i]?.[0] || '').trim();
    const name = String(data[i]?.[1] || '').trim();
    if (num && !isNaN(Number(num)) && Number(num) > 0 && name) {
      subjects.push(name);
    } else {
      break; // end of subject list
    }
  }

  return { startRow, subjects };
}

export const HOURS_PER_PAIR = 2;

/**
 * Sort sheet names like "MM.YY" chronologically (by year then month).
 * Alphabetical sort fails: "06.25" > "02.26" but Feb 2026 is newer.
 */
export function sortSheetsByDate(sheets: string[]): string[] {
  return [...sheets].sort((a, b) => {
    const [ma, ya] = a.split('.').map(Number);
    const [mb, yb] = b.split('.').map(Number);
    return (ya * 100 + ma) - (yb * 100 + mb);
  });
}

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
