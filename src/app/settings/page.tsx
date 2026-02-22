'use client';

import { useState, useEffect } from 'react';
import { getSyncSettings, saveSyncSettings } from '@/lib/sync';
import Link from 'next/link';

export default function SettingsPage() {
  const [scriptUrl, setScriptUrl] = useState('');
  const [pin, setPin] = useState('');
  const [saved, setSaved] = useState(false);
  const [dataSize, setDataSize] = useState('');

  useEffect(() => {
    const settings = getSyncSettings();
    if (settings) {
      setScriptUrl(settings.scriptUrl);
      setPin(settings.pin);
    }

    // Calculate localStorage usage
    try {
      const data = localStorage.getItem('el-jurnal-attendance');
      if (data) {
        const bytes = new Blob([data]).size;
        if (bytes < 1024) setDataSize(`${bytes} B`);
        else setDataSize(`${(bytes / 1024).toFixed(1)} KB`);
      } else {
        setDataSize('0 B');
      }
    } catch {
      setDataSize('N/A');
    }
  }, []);

  const handleSave = () => {
    saveSyncSettings({ scriptUrl, pin });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          localStorage.setItem('el-jurnal-attendance', JSON.stringify(data));
          alert('Данные импортированы!');
          window.location.reload();
        } catch {
          alert('Ошибка: неверный формат файла');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearData = () => {
    if (confirm('Удалить ВСЕ данные посещаемости? Это действие необратимо!')) {
      localStorage.removeItem('el-jurnal-attendance');
      alert('Данные удалены');
      window.location.reload();
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-8">
      <header className="bg-blue-500 text-white px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm bg-white/20 px-3 py-1.5 rounded-lg">
            &larr; Назад
          </Link>
          <h1 className="text-lg font-bold">Настройки</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Google Sheets sync */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Синхронизация с Google Sheets</h2>
        <p className="text-xs text-gray-400 mb-3">
          Вставьте URL из Google Apps Script для автоматической записи в таблицу
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">URL скрипта</label>
            <input
              type="url"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">PIN</label>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <button
            onClick={handleSave}
            className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
              saved ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
            }`}
          >
            {saved ? 'Сохранено!' : 'Сохранить настройки'}
          </button>
        </div>
      </div>

      {/* Data management */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Данные</h2>
        <p className="text-xs text-gray-400 mb-3">
          Размер данных: <span className="font-medium text-gray-600">{dataSize}</span>
        </p>
        <div className="space-y-2">
          <button
            onClick={handleExportAll}
            className="w-full py-2.5 rounded-xl font-medium text-sm bg-gray-100 text-gray-700"
          >
            Экспорт (JSON backup)
          </button>
          <button
            onClick={handleImport}
            className="w-full py-2.5 rounded-xl font-medium text-sm bg-gray-100 text-gray-700"
          >
            Импорт из файла
          </button>
          <button
            onClick={handleClearData}
            className="w-full py-2.5 rounded-xl font-medium text-sm bg-red-50 text-red-600"
          >
            Удалить все данные
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-4 text-center text-xs text-gray-400">
        <p>Журнал посещаемости v1.0</p>
        <p className="mt-1">Данные хранятся в браузере телефона</p>
      </div>
    </div>
  );
}
