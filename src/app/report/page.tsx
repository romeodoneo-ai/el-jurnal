'use client';

import { useState, useEffect } from 'react';
import { generateMonthReport, exportReportCSV, getFilledDates } from '@/lib/storage';
import { MonthReport } from '@/lib/types';
import { SUBJECTS } from '@/lib/config';
import Link from 'next/link';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export default function ReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthReport | null>(null);
  const [filledMonths, setFilledMonths] = useState<string[]>([]);

  useEffect(() => {
    const dates = getFilledDates();
    const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
    setFilledMonths(months);
  }, []);

  useEffect(() => {
    setReport(generateMonthReport(year, month));
  }, [year, month]);

  const handleExportCSV = () => {
    if (!report) return;
    const csv = exportReportCSV(report);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otchet-${report.group}-${String(month).padStart(2, '0')}.${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  const hasData = report.rows.some((r) => r.total > 0);

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Header */}
      <header className="bg-blue-500 text-white px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm bg-white/20 px-3 py-1.5 rounded-lg">
            &larr; Журнал
          </Link>
          <h1 className="text-lg font-bold">Отчёт</h1>
          <button
            onClick={handleExportCSV}
            className="text-sm bg-white/20 px-3 py-1.5 rounded-lg"
          >
            CSV
          </button>
        </div>
      </header>

      {/* Month selector */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MONTH_NAMES.map((name, i) => {
            const m = i + 1;
            const key = `${year}-${String(m).padStart(2, '0')}`;
            const hasDates = filledMonths.includes(key);
            return (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${
                  month === m
                    ? 'bg-blue-500 text-white font-medium'
                    : hasDates
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          {[2024, 2025, 2026].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 rounded-lg text-sm ${
                year === y ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-50 text-gray-400'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Report title */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 text-center">
        <h2 className="text-sm font-bold text-gray-700">
          Анализ посещаемости группы {report.group}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          за {report.month} {year} г. | Куратор: {report.curator}
        </p>
        <p className="text-xs text-gray-400">
          Всего часов: {report.totalHours}
        </p>
      </div>

      {!hasData ? (
        <div className="px-4 py-16 text-center text-gray-400">
          <p className="text-lg mb-2">Нет данных</p>
          <p className="text-sm">Заполните посещаемость за {MONTH_NAMES[month - 1].toLowerCase()}</p>
        </div>
      ) : (
        <>
          {/* Hours per subject */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-1 overflow-x-auto text-xs">
              {SUBJECTS.map((s) => (
                <div key={s} className="text-center shrink-0 min-w-[48px]">
                  <div className="text-gray-400 truncate">{s.slice(0, 4)}</div>
                  <div className="font-bold text-gray-600">{report.subjectHours[s]}ч</div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-left sticky left-0 bg-gray-50 z-10 min-w-[140px]">ФИО</th>
                  {SUBJECTS.map((s) => (
                    <th key={s} className="px-1.5 py-2 text-center min-w-[36px]">
                      <span className="writing-mode-vertical" title={s}>{s.slice(0, 3)}</span>
                    </th>
                  ))}
                  <th className="px-1.5 py-2 text-center font-bold">Ит.</th>
                  <th className="px-1.5 py-2 text-center">Ув.</th>
                  <th className="px-1.5 py-2 text-center">%</th>
                  <th className="px-1.5 py-2 text-center">%Н</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, i) => {
                  if (!row.studentName) return null;
                  const isHighlight = row.total > 0;
                  return (
                    <tr
                      key={row.studentId}
                      className={`border-b border-gray-100 ${
                        isHighlight ? '' : 'text-gray-300'
                      }`}
                    >
                      <td className="px-2 py-2 sticky left-0 bg-white z-10 font-medium truncate max-w-[140px]">
                        <span className="text-gray-400 mr-1">{i + 1}.</span>
                        {row.studentName}
                      </td>
                      {SUBJECTS.map((s) => (
                        <td
                          key={s}
                          className={`px-1.5 py-2 text-center ${
                            row.bySubject[s] > 0 ? 'text-red-600 font-medium' : 'text-gray-300'
                          }`}
                        >
                          {row.bySubject[s] || ''}
                        </td>
                      ))}
                      <td className={`px-1.5 py-2 text-center font-bold ${
                        row.total > 0 ? 'text-red-600' : 'text-gray-300'
                      }`}>
                        {row.total || ''}
                      </td>
                      <td className="px-1.5 py-2 text-center text-amber-600">
                        {row.excused || ''}
                      </td>
                      <td className={`px-1.5 py-2 text-center ${
                        parseInt(row.totalPercent) > 30 ? 'text-red-600 font-bold' : ''
                      }`}>
                        {row.total > 0 ? row.totalPercent : ''}
                      </td>
                      <td className={`px-1.5 py-2 text-center ${
                        parseInt(row.unexcusedPercent) > 20 ? 'text-red-600 font-bold' : ''
                      }`}>
                        {row.total > 0 ? row.unexcusedPercent : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
