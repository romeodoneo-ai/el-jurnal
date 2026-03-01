import { google, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheets(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error('Google Sheets не настроен: добавьте GOOGLE_SERVICE_ACCOUNT_EMAIL и GOOGLE_PRIVATE_KEY в переменные окружения');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

const sid = () => process.env.GOOGLE_SPREADSHEET_ID!;

export async function getFormattedValues(range: string): Promise<string[][]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sid(),
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values || []) as string[][];
}

export async function updateValues(range: string, values: unknown[][]): Promise<void> {
  await getSheets().spreadsheets.values.update({
    spreadsheetId: sid(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function clearRange(range: string): Promise<void> {
  await getSheets().spreadsheets.values.clear({
    spreadsheetId: sid(),
    range,
  });
}

export async function listSheetNames(): Promise<string[]> {
  const res = await getSheets().spreadsheets.get({
    spreadsheetId: sid(),
    fields: 'sheets.properties.title',
  });
  return (res.data.sheets || []).map((s) => s.properties?.title || '');
}

/** Get the numeric sheetId for a given sheet name (needed for formatting API). */
export async function getSheetId(sheetName: string): Promise<number> {
  const res = await getSheets().spreadsheets.get({
    spreadsheetId: sid(),
    fields: 'sheets.properties',
  });
  const sheet = (res.data.sheets || []).find((s) => s.properties?.title === sheetName);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheet.properties.sheetId;
}

/** Send a batchUpdate request (for formatting, borders, merges, etc). */
export async function batchUpdate(requests: sheets_v4.Schema$Request[]): Promise<void> {
  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: sid(),
    requestBody: { requests },
  });
}

/** Ensure a sheet exists; create it if it doesn't. */
export async function ensureSheet(name: string): Promise<void> {
  const names = await listSheetNames();
  if (names.includes(name)) return;
  await batchUpdate([{ addSheet: { properties: { title: name } } }]);
}

/** Insert rows into a sheet. startIndex is 0-based. Shifts all data below down. */
export async function insertRows(sheetId: number, startIndex: number, count: number): Promise<void> {
  await batchUpdate([{
    insertDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + count },
      inheritFromBefore: true,
    },
  }]);
}

/** Delete rows from a sheet. startIndex is 0-based. Shifts all data below up. */
export async function deleteRows(sheetId: number, startIndex: number, count: number): Promise<void> {
  await batchUpdate([{
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + count },
    },
  }]);
}
