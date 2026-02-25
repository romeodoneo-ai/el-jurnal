'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [statusMsg, setStatusMsg] = useState('');
  const [dataSize, setDataSize] = useState('');

  useEffect(() => {
    // Check connection to Google Sheets
    async function checkConnection() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setStatus('connected');
          setStatusMsg(`${data.groupName} | ${data.students.length} студентов | ${data.subjects.length} предметов`);
        } else {
          const err = await res.json();
          setStatus('error');
          setStatusMsg(err.error || 'Ошибка API');
        }
      } catch {
        setStatus('error');
        setStatusMsg('Нет подключения к серверу');
      }
    }
    checkConnection();

    try {
      const data = localStorage.getItem('el-jurnal-attendance');
      if (data) {
        const bytes = new Blob([data]).size;
        setDataSize(bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
      } else {
        setDataSize('0 B');
      }
    } catch {
      setDataSize('N/A');
    }
  }, []);

  const handleExportAll = () => {
    try {
      const data = localStorage.getItem('el-jurnal-attendance') || '{}';
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jurnal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Ошибка экспорта: ' + err);
    }
  };

  const handleClearCache = () => {
    if (confirm('Очистить локальный кеш? Данные в Google Таблице останутся.')) {
      localStorage.removeItem('el-jurnal-attendance');
      localStorage.removeItem('el-jurnal-config-cache');
      alert('Кеш очищен');
      window.location.reload();
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-8">
      <header className="bg-blue-500 text-white px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm bg-white/20 px-3 py-1.5 rounded-lg">&larr; Назад</Link>
          <h1 className="text-lg font-bold">Настройки</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Connection status */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Google Sheets</h2>
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${
          status === 'connected' ? 'bg-emerald-50' : status === 'error' ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'
          }`} />
          <span className="text-sm">
            {status === 'checking' && 'Проверка подключения...'}
            {status === 'connected' && 'Подключено'}
            {status === 'error' && 'Не подключено'}
          </span>
        </div>
        {statusMsg && (
          <p className={`text-xs mt-2 ${status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
            {statusMsg}
          </p>
        )}
        {status === 'error' && (
          <p className="text-xs mt-2 text-gray-400">
            Убедитесь, что Environment Variables настроены в Vercel (GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).
          </p>
        )}
      </div>

      {/* Data management */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Локальный кеш</h2>
        <p className="text-xs text-gray-400 mb-3">
          Размер: <span className="font-medium text-gray-600">{dataSize}</span>
          <br />Кеш используется для офлайн-режима. Основные данные — в Google Таблице.
        </p>
        <div className="space-y-2">
          <button onClick={handleExportAll} className="w-full py-2.5 rounded-xl font-medium text-sm bg-gray-100 text-gray-700">
            Экспорт кеша (JSON)
          </button>
          <button onClick={handleClearCache} className="w-full py-2.5 rounded-xl font-medium text-sm bg-red-50 text-red-600">
            Очистить кеш
          </button>
        </div>
      </div>

      <div className="px-4 py-4 text-center text-xs text-gray-400">
        <p>Журнал посещаемости v2.0</p>
        <p className="mt-1">Данные хранятся в Google Sheets + локальный кеш</p>
      </div>
    </div>
  );
}
