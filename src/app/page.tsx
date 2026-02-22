'use client';

import { useState, useEffect, useCallback } from 'react';
import { STUDENTS, SUBJECTS } from '@/lib/config';
import { getDayAttendance, saveDayAttendance } from '@/lib/storage';
import { AttendanceStatus, DayAttendance, PairAttendance } from '@/lib/types';
import { syncSaveAttendance, getSyncSettings } from '@/lib/sync';
import Link from 'next/link';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function createEmptyPairs(count: number): PairAttendance[] {
  return Array.from({ length: count }, (_, i) => ({
    pairNumber: i + 1,
    subject: '',
    attendance: {},
  }));
}

function StatusBadge({ status, onClick }: { status: AttendanceStatus; onClick: () => void }) {
  if (status === 'Н') {
    return (
      <button
        onClick={onClick}
        className="w-12 h-12 rounded-xl bg-red-500 text-white font-bold text-lg flex items-center justify-center active:scale-95 transition-transform shadow-sm"
      >
        Н
      </button>
    );
  }
  if (status === 'У') {
    return (
      <button
        onClick={onClick}
        className="w-12 h-12 rounded-xl bg-amber-400 text-white font-bold text-lg flex items-center justify-center active:scale-95 transition-transform shadow-sm"
      >
        У
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 font-bold text-lg flex items-center justify-center active:scale-95 transition-transform border border-emerald-200"
    >
      +
    </button>
  );
}

export default function Home() {
  const [date, setDate] = useState(todayStr());
  const [pairCount, setPairCount] = useState(4);
  const [pairs, setPairs] = useState<PairAttendance[]>(createEmptyPairs(4));
  const [activePair, setActivePair] = useState(0);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = getDayAttendance(date);
    if (existing) {
      setPairs(existing.pairs);
      setPairCount(existing.pairs.length);
    } else {
      setPairs(createEmptyPairs(4));
      setPairCount(4);
    }
    setActivePair(0);
    setSaved(false);
    setLoaded(true);
  }, [date]);

  const toggleStatus = useCallback((studentId: number) => {
    setPairs((prev) => {
      const next = [...prev];
      const pair = { ...next[activePair] };
      const newAtt = { ...pair.attendance };
      const current = newAtt[studentId] || '';

      if (current === '') newAtt[studentId] = 'Н';
      else if (current === 'Н') newAtt[studentId] = 'У';
      else delete newAtt[studentId];

      pair.attendance = newAtt;
      next[activePair] = pair;
      return next;
    });
    setSaved(false);
  }, [activePair]);

  const setSubject = useCallback((subject: string) => {
    setPairs((prev) => {
      const next = [...prev];
      next[activePair] = { ...next[activePair], subject };
      return next;
    });
    setSaved(false);
  }, [activePair]);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const handleSave = useCallback(async () => {
    const day: DayAttendance = {
      date,
      pairs: pairs.slice(0, pairCount),
    };
    saveDayAttendance(day);
    setSaved(true);

    // Sync to Google Sheets if configured
    const settings = getSyncSettings();
    if (settings?.scriptUrl) {
      setSyncing(true);
      const result = await syncSaveAttendance(day);
      setSyncMsg(result.message);
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 3000);
    }

    setTimeout(() => setSaved(false), 2000);
  }, [date, pairs, pairCount]);

  const markAllPresent = useCallback(() => {
    setPairs((prev) => {
      const next = [...prev];
      next[activePair] = { ...next[activePair], attendance: {} };
      return next;
    });
    setSaved(false);
  }, [activePair]);

  const absentCount = Object.values(pairs[activePair]?.attendance || {}).filter(Boolean).length;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-lg">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <header className="bg-blue-500 text-white px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between">
          <Link href="/settings" className="text-sm bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </Link>
          <h1 className="text-lg font-bold">Журнал СИС-12</h1>
          <Link
            href="/report"
            className="text-sm bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors"
          >
            Отчёт
          </Link>
        </div>
      </header>

      {/* Date picker */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <span className="text-sm text-gray-500 font-medium min-w-[80px] text-right">
            {formatDate(date)}
          </span>
        </div>
      </div>

      {/* Pair tabs */}
      <div className="px-4 py-2 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          {Array.from({ length: pairCount }, (_, i) => {
            const pairAbsent = Object.values(pairs[i]?.attendance || {}).filter(Boolean).length;
            return (
              <button
                key={i}
                onClick={() => setActivePair(i)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all relative ${
                  activePair === i
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Пара {i + 1}
                {pairAbsent > 0 && (
                  <span className={`absolute -top-1.5 -right-1 min-w-5 h-5 px-1 rounded-full text-xs flex items-center justify-center font-bold ${
                    activePair === i ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
                  }`}>
                    {pairAbsent}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-400">Кол-во пар:</span>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => {
                setPairCount(n);
                if (activePair >= n) setActivePair(n - 1);
                setPairs((prev) => {
                  if (prev.length >= n) return prev;
                  return [...prev, ...createEmptyPairs(n - prev.length)];
                });
              }}
              className={`w-8 h-7 rounded-lg text-xs font-medium ${
                pairCount === n
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Subject selector */}
      <div className="px-4 py-2 bg-white border-b border-gray-100">
        <select
          value={pairs[activePair]?.subject || ''}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">-- Предмет --</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Info bar */}
      <div className="px-4 py-2 bg-gray-50 flex items-center justify-between border-b border-gray-100">
        <span className="text-xs text-gray-500">
          Нет: <span className="font-bold text-gray-700">{absentCount}</span> / {STUDENTS.length}
        </span>
        {absentCount > 0 && (
          <button onClick={markAllPresent} className="text-xs text-blue-500 font-medium">
            Сбросить
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-1.5 bg-gray-50 flex gap-4 text-xs text-gray-400 border-b border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 inline-block" /> Есть
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Н
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> У
        </span>
      </div>

      {/* Student list */}
      <div className="divide-y divide-gray-100">
        {STUDENTS.map((student) => {
          const status = (pairs[activePair]?.attendance[student.id] || '') as AttendanceStatus;
          return (
            <div
              key={student.id}
              className={`flex items-center px-4 py-2.5 gap-3 transition-colors ${
                status === 'Н' ? 'bg-red-50' : status === 'У' ? 'bg-amber-50' : 'bg-white'
              }`}
            >
              <span className="text-xs text-gray-400 w-5 text-right shrink-0">{student.id}</span>
              <span className="flex-1 text-sm font-medium truncate">{student.name}</span>
              <StatusBadge status={status} onClick={() => toggleStatus(student.id)} />
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t shadow-lg z-50">
        <div className="max-w-lg mx-auto">
          {syncMsg && (
            <p className="text-xs text-center text-gray-500 mb-1">{syncMsg}</p>
          )}
          <button
            onClick={handleSave}
            disabled={syncing}
            className={`w-full py-3.5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-md ${
              saved
                ? 'bg-emerald-500 text-white'
                : syncing
                ? 'bg-gray-400 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            {syncing ? 'Синхронизация...' : saved ? 'Сохранено!' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
