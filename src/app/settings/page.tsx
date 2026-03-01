'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StudentItem {
  id: number;
  name: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [statusMsg, setStatusMsg] = useState('');
  const [dataSize, setDataSize] = useState('');

  // Settings
  const [groupName, setGroupName] = useState('');
  const [curator, setCurator] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Students
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [editStudentIdx, setEditStudentIdx] = useState<number | null>(null);
  const [editStudentValue, setEditStudentValue] = useState('');
  const [studentsSaving, setStudentsSaving] = useState(false);
  const [studentsMsg, setStudentsMsg] = useState('');

  // Subjects
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [subjectsSaving, setSubjectsSaving] = useState(false);
  const [subjectsMsg, setSubjectsMsg] = useState('');

  useEffect(() => {
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

    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setGroupName(data.groupName || '');
          setCurator(data.curator || '');
          setAcademicYear(data.academicYear || '');
        }
      } catch { /* offline */ }
    }

    async function loadStudents() {
      try {
        const res = await fetch('/api/students');
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students || []);
        }
      } catch { /* offline */ }
    }

    async function loadSubjects() {
      try {
        const res = await fetch('/api/subjects');
        if (res.ok) {
          const data = await res.json();
          setSubjects(data.subjects || []);
        }
      } catch { /* offline */ }
    }

    checkConnection();
    loadSettings();
    loadStudents();
    loadSubjects();

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

  // --- Settings save ---
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, curator, academicYear }),
      });
      if (res.ok) {
        setSettingsMsg('Сохранено');
        setTimeout(() => setSettingsMsg(''), 2000);
      } else {
        const err = await res.json();
        setSettingsMsg(`Ошибка: ${err.error}`);
      }
    } catch {
      setSettingsMsg('Нет подключения');
    }
    setSettingsSaving(false);
  };

  // --- Student rename ---
  const handleStartStudentEdit = (idx: number) => {
    setEditStudentIdx(idx);
    setEditStudentValue(students[idx].name);
  };

  const handleSaveStudentEdit = async () => {
    if (editStudentIdx === null) return;
    const name = editStudentValue.trim();
    if (!name) return;
    const updated = [...students];
    updated[editStudentIdx] = { ...updated[editStudentIdx], name };
    setStudentsSaving(true);
    setStudentsMsg('');
    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: updated }),
      });
      if (res.ok) {
        setStudents(updated);
        setStudentsMsg('Сохранено');
        setTimeout(() => setStudentsMsg(''), 2000);
      } else {
        const err = await res.json();
        setStudentsMsg(`Ошибка: ${err.error}`);
      }
    } catch {
      setStudentsMsg('Нет подключения');
    }
    setStudentsSaving(false);
    setEditStudentIdx(null);
    setEditStudentValue('');
  };

  // --- Subject management ---
  const saveSubjects = async (updated: string[]) => {
    setSubjectsSaving(true);
    setSubjectsMsg('');
    try {
      const res = await fetch('/api/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updated }),
      });
      if (res.ok) {
        setSubjects(updated);
        setSubjectsMsg('Сохранено');
        setTimeout(() => setSubjectsMsg(''), 2000);
      } else {
        const err = await res.json();
        setSubjectsMsg(`Ошибка: ${err.error}`);
      }
    } catch {
      setSubjectsMsg('Нет подключения');
    }
    setSubjectsSaving(false);
  };

  const handleAddSubject = () => {
    const name = newSubject.trim();
    if (!name || subjects.includes(name)) return;
    saveSubjects([...subjects, name]);
    setNewSubject('');
  };

  const handleDeleteSubject = (idx: number) => {
    saveSubjects(subjects.filter((_, i) => i !== idx));
  };

  const handleStartEdit = (idx: number) => {
    setEditIdx(idx);
    setEditValue(subjects[idx]);
  };

  const handleSaveEdit = () => {
    if (editIdx === null) return;
    const name = editValue.trim();
    if (!name) return;
    const updated = [...subjects];
    updated[editIdx] = name;
    saveSubjects(updated);
    setEditIdx(null);
    setEditValue('');
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
      </div>

      {/* Group settings */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">Группа и куратор</h2>
          {settingsMsg && (
            <span className={`text-xs ${settingsMsg.startsWith('Ошибка') ? 'text-red-500' : 'text-emerald-600'}`}>
              {settingsMsg}
            </span>
          )}
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="text-xs text-gray-400 mb-0.5 block">Название группы</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="СИС-12"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-0.5 block">Куратор</label>
            <input
              value={curator}
              onChange={(e) => setCurator(e.target.value)}
              placeholder="ФИО куратора"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-0.5 block">Учебный год</label>
            <input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2024-2025"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={settingsSaving}
            className="w-full py-2.5 rounded-xl font-medium text-sm bg-blue-500 text-white disabled:opacity-40"
          >
            {settingsSaving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>

      {/* Students */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">Студенты</h2>
          {studentsMsg && (
            <span className={`text-xs ${studentsMsg.startsWith('Ошибка') ? 'text-red-500' : 'text-emerald-600'}`}>
              {studentsMsg}
            </span>
          )}
        </div>
        {students.length === 0 ? (
          <p className="text-xs text-gray-400 mb-3">Загрузка...</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {students.map((st, i) => (
              <div key={st.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right">{st.id}.</span>
                {editStudentIdx === i ? (
                  <>
                    <input
                      value={editStudentValue}
                      onChange={(e) => setEditStudentValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveStudentEdit()}
                      className="flex-1 text-sm px-2 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveStudentEdit}
                      disabled={studentsSaving}
                      className="text-xs text-emerald-600 font-medium px-2"
                    >OK</button>
                    <button onClick={() => setEditStudentIdx(null)} className="text-xs text-gray-400 px-1">X</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700">{st.name}</span>
                    <button onClick={() => handleStartStudentEdit(i)} className="text-xs text-blue-500 px-2">
                      Изм.
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Для добавления/удаления студентов редактируйте Google Таблицу напрямую.
        </p>
      </div>

      {/* Subject management */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">Предметы</h2>
          {subjectsMsg && (
            <span className={`text-xs ${subjectsMsg.startsWith('Ошибка') ? 'text-red-500' : 'text-emerald-600'}`}>
              {subjectsMsg}
            </span>
          )}
        </div>

        {subjects.length === 0 ? (
          <p className="text-xs text-gray-400 mb-3">Загрузка...</p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {subjects.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                {editIdx === i ? (
                  <>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      className="flex-1 text-sm px-2 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="text-xs text-emerald-600 font-medium px-2">OK</button>
                    <button onClick={() => setEditIdx(null)} className="text-xs text-gray-400 px-1">X</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700">{s}</span>
                    <button onClick={() => handleStartEdit(i)} className="text-xs text-blue-500 px-2">
                      Изм.
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(i)}
                      className="text-xs text-red-400 px-1"
                      disabled={subjectsSaving}
                    >
                      X
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
            placeholder="Новый предмет..."
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleAddSubject}
            disabled={!newSubject.trim() || subjectsSaving}
            className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-xl disabled:opacity-40"
          >
            +
          </button>
        </div>
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
