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
  STUDENTS_END_ROW: 27,
  DATA_START_COL: 7, // Column G (1-based)
  PAIRS_PER_DATE: 4,
};

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
