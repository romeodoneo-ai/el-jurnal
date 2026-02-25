'use client';

import { useState } from 'react';
import { exportReportCSV } from '@/lib/storage';
import { MonthReport } from '@/lib/types';
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
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setReport(data.report);
        setMessage(data.message || 'Отчёт сгенерирован');
      } else {
        setMessage(data.error || 'Ошибка генерации');
      }
    } catch {
      setMessage('Ошибка сети');
    }
    setGenerating(false);
  };

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

  const subjects = report?.subjects || [];

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Header */}
      <header className="bg-blue-500 text-white px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm bg-white/20 px-3 py-1.5 rounded-lg">&larr; Журнал</Link>
          <h1 className="text-lg font-bold">Отчёт</h1>
          <button onClick={handleExportCSV} disabled={!report} className="text-sm bg-white/20 px-3 py-1.5 rounded-lg disabled:opacity-40">CSV</button>
        </div>
      </header>

      {/* Month selector */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MONTH_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => { setMonth(i + 1); setReport(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${
                month === i + 1 ? 'bg-blue-500 text-white font-medium' : 'bg-gray-100 text-gray-400'
              }`}
            >{name.slice(0, 3)}</button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          {[2024, 2025, 2026].map((y) => (
            <button
              key={y}
              onClick={() => { setYear(y); setReport(null); }}
              className={`px-3 py-1 rounded-lg text-sm ${
                year === y ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-50 text-gray-400'
              }`}
            >{y}</button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
            generating ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 text-white active:scale-[0.98]'
          }`}
        >
          {generating ? 'Генерация...' : `Сгенерировать отчёт за ${MONTH_NAMES[month - 1].toLowerCase()}`}
        </button>
        {message && (
          <p className={`text-sm text-center mt-2 ${message.includes('Ошибка') ? 'text-red-500' : 'text-emerald-600'}`}>
            {message}
          </p>
        )}
        {report && !message.includes('Ошибка') && (
          <p className="text-xs text-center mt-1 text-gray-400">
            Листы &laquo;Отчет&raquo; и &laquo;Подробно&raquo; обновлены в Google Таблице
          </p>
        )}
      </div>

      {report && (
        <>
          {/* Report title */}
          <div className="px-4 py-3 bg-white border-b border-gray-100 text-center">
            <h2 className="text-sm font-bold text-gray-700">Анализ посещаемости группы {report.group}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              за {report.month} {year} г. | Куратор: {report.curator}
            </p>
            <p className="text-xs text-gray-400">Всего часов: {report.totalHours}</p>
          </div>

          {/* Hours per subject */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-1 overflow-x-auto text-xs">
              {subjects.map((s) => (
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
                  {subjects.map((s) => (
                    <th key={s} className="px-1.5 py-2 text-center min-w-[36px]" title={s}>{s.slice(0, 3)}</th>
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
                  return (
                    <tr key={row.studentId} className={`border-b border-gray-100 ${row.total > 0 ? '' : 'text-gray-300'}`}>
                      <td className="px-2 py-2 sticky left-0 bg-white z-10 font-medium truncate max-w-[140px]">
                        <span className="text-gray-400 mr-1">{i + 1}.</span>{row.studentName}
                      </td>
                      {subjects.map((s) => (
                        <td key={s} className={`px-1.5 py-2 text-center ${row.bySubject[s] > 0 ? 'text-red-600 font-medium' : 'text-gray-300'}`}>
                          {row.bySubject[s] || ''}
                        </td>
                      ))}
                      <td className={`px-1.5 py-2 text-center font-bold ${row.total > 0 ? 'text-red-600' : 'text-gray-300'}`}>{row.total || ''}</td>
                      <td className="px-1.5 py-2 text-center text-amber-600">{row.excused || ''}</td>
                      <td className={`px-1.5 py-2 text-center ${parseInt(row.totalPercent) > 30 ? 'text-red-600 font-bold' : ''}`}>{row.total > 0 ? row.totalPercent : ''}</td>
                      <td className={`px-1.5 py-2 text-center ${parseInt(row.unexcusedPercent) > 20 ? 'text-red-600 font-bold' : ''}`}>{row.total > 0 ? row.unexcusedPercent : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!report && (
        <div className="px-4 py-16 text-center text-gray-400">
          <p className="text-lg mb-2">Выберите месяц и нажмите &laquo;Сгенерировать&raquo;</p>
          <p className="text-sm">Отчёт будет создан из данных Google Таблицы</p>
        </div>
      )}
    </div>
  );
}
