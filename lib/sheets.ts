import { google } from 'googleapis';

const getEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

export const getSheetsClient = () => {
  const clientEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
    .replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
};

export const getSheetValues = async (sheetName: string, range: string = 'A:Z') => {
  const spreadsheetId = getEnv('GOOGLE_SHEETS_ID');
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const values = (res.data.values ?? []) as any[];
  return values.map((row: any[]) => row.map((c) => (c === undefined || c === null ? '' : String(c))));
};
