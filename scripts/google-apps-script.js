/**
 * Google Apps Script для журнала посещаемости СИС-12
 *
 * ИНСТРУКЦИЯ:
 * 1. Откройте вашу Google Таблицу
 * 2. Расширения → Apps Script
 * 3. Удалите всё содержимое файла Code.gs
 * 4. Вставьте этот код
 * 5. Нажмите "Развернуть" → "Новое развёртывание"
 * 6. Тип: "Веб-приложение"
 * 7. Выполнять от имени: "Я"
 * 8. Доступ: "Все"
 * 9. Нажмите "Развернуть" и скопируйте URL
 * 10. Вставьте URL в настройках приложения
 */

// ===== НАСТРОЙКИ =====
const PIN = '1234'; // Измените на свой PIN
// =====================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter || {};
  const action = params.action;
  const pin = params.pin;

  // Проверка PIN
  if (pin !== PIN) {
    return jsonResponse({ error: 'Неверный PIN' }, 403);
  }

  try {
    switch (action) {
      case 'getStudents':
        return jsonResponse(getStudents());

      case 'getAttendance':
        return jsonResponse(getAttendance(params.date));

      case 'saveAttendance':
        const data = JSON.parse(e.postData ? e.postData.contents : params.data);
        return jsonResponse(saveAttendance(data));

      case 'getReport':
        return jsonResponse(getReport(parseInt(params.month), parseInt(params.year)));

      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function jsonResponse(data, code) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Получить список студентов =====
function getStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Берём первый лист с данными (например, 01.25)
  const sheets = ss.getSheets().filter(s => /^\d{2}\.\d{2}$/.test(s.getName()));
  if (sheets.length === 0) return { students: [] };

  const sheet = sheets[0];
  const data = sheet.getRange('A4:B35').getValues();

  const students = [];
  for (const row of data) {
    if (row[0] && row[1]) {
      students.push({ id: parseInt(row[0]), name: row[1] });
    }
  }

  return { students };
}

// ===== Получить данные посещаемости за день =====
function getAttendance(dateStr) {
  // dateStr формат: "2025-01-13"
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  const sheetName = String(month).padStart(2, '0') + '.' + String(year).slice(-2);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { date: dateStr, pairs: [] };
  }

  // Найти колонку по дате
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dayStr = String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0');

  let startCol = -1;
  for (let i = 6; i < headerRow.length; i++) {
    const cell = String(headerRow[i]).trim();
    if (cell === dayStr) {
      startCol = i;
      break;
    }
  }

  if (startCol === -1) {
    return { date: dateStr, pairs: [] };
  }

  // Получить предметы (строка 3) и данные студентов
  const subjectRow = sheet.getRange(3, startCol + 1, 1, 4).getValues()[0];
  const studentData = sheet.getRange(4, 1, 32, startCol + 5).getValues();

  const pairs = [];
  for (let p = 0; p < 4; p++) {
    const subject = subjectRow[p] ? String(subjectRow[p]).trim() : '';
    if (!subject) continue;

    const attendance = {};
    for (let s = 0; s < 32; s++) {
      const studentId = studentData[s][0];
      if (!studentId || !studentData[s][1]) continue;

      const cell = String(studentData[s][startCol + p] || '').trim().toUpperCase();
      if (cell === 'Н' || cell === 'У') {
        attendance[studentId] = cell;
      }
    }

    pairs.push({
      pairNumber: p + 1,
      subject: subject,
      attendance: attendance
    });
  }

  return { date: dateStr, pairs: pairs };
}

// ===== Сохранить данные посещаемости =====
function saveAttendance(data) {
  // data = { date: "2025-01-13", pairs: [...] }
  const parts = data.date.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  const sheetName = String(month).padStart(2, '0') + '.' + String(year).slice(-2);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { error: 'Лист ' + sheetName + ' не найден' };
  }

  // Найти колонку по дате
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dayStr = String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0');

  let startCol = -1;
  for (let i = 6; i < headerRow.length; i++) {
    const cell = String(headerRow[i]).trim();
    if (cell === dayStr) {
      startCol = i;
      break;
    }
  }

  if (startCol === -1) {
    return { error: 'Дата ' + dayStr + ' не найдена на листе ' + sheetName };
  }

  // Получить список студентов (ID → номер строки)
  const studentIds = sheet.getRange(4, 1, 32, 1).getValues();
  const idToRow = {};
  for (let i = 0; i < studentIds.length; i++) {
    if (studentIds[i][0]) {
      idToRow[parseInt(studentIds[i][0])] = i + 4; // строки начинаются с 4
    }
  }

  // Записать данные
  for (const pair of data.pairs) {
    const colIndex = startCol + (pair.pairNumber - 1); // 0-indexed

    // Очистить колонку для этой пары (все студенты = присутствуют)
    for (const id in idToRow) {
      const row = idToRow[id];
      sheet.getRange(row, colIndex + 1).setValue('');
    }

    // Записать отсутствующих
    for (const studentId in pair.attendance) {
      const status = pair.attendance[studentId];
      const row = idToRow[parseInt(studentId)];
      if (row && (status === 'Н' || status === 'У')) {
        sheet.getRange(row, colIndex + 1).setValue(status);
      }
    }
  }

  return { success: true, message: 'Сохранено: ' + dayStr };
}

// ===== Сгенерировать отчёт за месяц =====
function getReport(month, year) {
  const sheetName = String(month).padStart(2, '0') + '.' + String(year).slice(-2);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { error: 'Лист ' + sheetName + ' не найден' };
  }

  // Проверяем есть ли лист "Подробно"
  const detailSheet = ss.getSheetByName(sheetName + 'Подробно');
  if (detailSheet) {
    // Читаем из существующего листа "Подробно"
    const data = detailSheet.getDataRange().getValues();
    return { source: 'sheet', data: data };
  }

  // Проверяем есть ли лист "Отчёт"
  const reportSheet = ss.getSheetByName(sheetName + 'Отчет');
  if (reportSheet) {
    const data = reportSheet.getDataRange().getValues();
    return { source: 'sheet', data: data };
  }

  return { error: 'Листы отчёта не найдены' };
}
