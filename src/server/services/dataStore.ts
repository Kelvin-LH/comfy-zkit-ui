import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Excel file paths
const USERS_FILE = path.join(DATA_DIR, 'users.xlsx');
const CONFIG_FILE = path.join(DATA_DIR, 'config.xlsx');
const HISTORY_FILE = path.join(DATA_DIR, 'history.xlsx');

// Initialize Excel files if they don't exist
function initExcelFile(filePath: string, headers: string[], defaultData?: Record<string, unknown>[]) {
  if (!fs.existsSync(filePath)) {
    const wb = XLSX.utils.book_new();
    const data = defaultData || [];
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filePath);
  }
}

// Initialize all data files
export function initDataFiles() {
  // Users file with default admin
  initExcelFile(USERS_FILE, ['id', 'username', 'password', 'role', 'createdAt'], [
    {
      id: 1,
      username: 'admin',
      password: '$2a$10$rQnM1.5YwGvLqPKqPKqPKuPKqPKqPKqPKqPKqPKqPKqPKqPKqPKqPK', // Will be set on first run
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  ]);

  // Config file with defaults
  initExcelFile(CONFIG_FILE, ['key', 'value'], [
    { key: 'companyName', value: '卡通图生成器' },
    { key: 'logo', value: '' },
    { key: 'comfyuiUrl', value: 'http://127.0.0.1:8188' }
  ]);

  // History file
  initExcelFile(HISTORY_FILE, ['id', 'userId', 'originalImage', 'resultImage', 'seed', 'status', 'createdAt']);
}

// Read Excel file as JSON
function readExcel<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<T>(ws);
}

// Write JSON to Excel file
function writeExcel<T extends Record<string, unknown>>(filePath: string, data: T[], headers?: string[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);
}

// User operations
export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export function getUsers(): User[] {
  return readExcel<User>(USERS_FILE);
}

export function getUserByUsername(username: string): User | undefined {
  const users = getUsers();
  return users.find(u => u.username === username);
}

export function getUserById(id: number): User | undefined {
  const users = getUsers();
  return users.find(u => u.id === id);
}

export function createUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeExcel(USERS_FILE, users);
  return newUser;
}

export function updateUser(id: number, updates: Partial<User>): User | undefined {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], ...updates };
  writeExcel(USERS_FILE, users);
  return users[index];
}

// Config operations
export interface ConfigItem {
  key: string;
  value: string;
}

export function getConfig(): ConfigItem[] {
  return readExcel<ConfigItem>(CONFIG_FILE);
}

export function getConfigValue(key: string): string | undefined {
  const config = getConfig();
  const item = config.find(c => c.key === key);
  return item?.value;
}

export function setConfigValue(key: string, value: string): void {
  const config = getConfig();
  const index = config.findIndex(c => c.key === key);
  if (index >= 0) {
    config[index].value = value;
  } else {
    config.push({ key, value });
  }
  writeExcel(CONFIG_FILE, config);
}

export function getAllConfig(): Record<string, string> {
  const config = getConfig();
  const result: Record<string, string> = {};
  config.forEach(item => {
    result[item.key] = item.value;
  });
  return result;
}

// History operations
export interface HistoryRecord {
  id: number;
  userId: number;
  originalImage: string;
  resultImage: string;
  seed: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export function getHistory(): HistoryRecord[] {
  return readExcel<HistoryRecord>(HISTORY_FILE);
}

export function getHistoryByUserId(userId: number): HistoryRecord[] {
  const history = getHistory();
  return history.filter(h => h.userId === userId);
}

export function createHistoryRecord(record: Omit<HistoryRecord, 'id' | 'createdAt'>): HistoryRecord {
  const history = getHistory();
  const newRecord: HistoryRecord = {
    ...record,
    id: history.length > 0 ? Math.max(...history.map(h => h.id)) + 1 : 1,
    createdAt: new Date().toISOString()
  };
  history.push(newRecord);
  writeExcel(HISTORY_FILE, history);
  return newRecord;
}

export function updateHistoryRecord(id: number, updates: Partial<HistoryRecord>): HistoryRecord | undefined {
  const history = getHistory();
  const index = history.findIndex(h => h.id === id);
  if (index === -1) return undefined;
  history[index] = { ...history[index], ...updates };
  writeExcel(HISTORY_FILE, history);
  return history[index];
}

// Initialize on module load
initDataFiles();
