export type AttendanceStatus = '' | 'Н' | 'У';

export interface Student {
  id: number;
  name: string;
}

export interface PairAttendance {
  pairNumber: number;
  subject: string;
  attendance: Record<number, AttendanceStatus>; // studentId -> status
}

export interface DayAttendance {
  date: string; // "2025-01-13"
  pairs: PairAttendance[];
}

export interface ReportRow {
  studentId: number;
  studentName: string;
  bySubject: Record<string, number>; // subject -> total missed hours
  total: number;
  excused: number;
  totalPercent: string;
  unexcusedPercent: string;
}

export interface MonthReport {
  month: string;
  year: string;
  group: string;
  curator: string;
  subjects: string[];
  subjectHours: Record<string, number>;
  totalHours: number;
  rows: ReportRow[];
}
