import * as fs from 'fs';
import * as path from 'path';

const LOG_ROOT = path.resolve(process.cwd(), '../artifacts/setup_review/logs');

async function readJsonArray(filePath: string): Promise<Record<string, unknown>[]> {
  if (!fs.existsSync(filePath)) return [];
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
}

export async function appendJsonLog(
  fileName: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const filePath = path.join(LOG_ROOT, fileName);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const rows = await readJsonArray(filePath);
  rows.push({
    ...entry,
    loggedAt: new Date().toISOString(),
  });
  await fs.promises.writeFile(filePath, JSON.stringify(rows, null, 2));
}

export async function readJsonLog(fileName: string): Promise<Record<string, unknown>[]> {
  const filePath = path.join(LOG_ROOT, fileName);
  return readJsonArray(filePath);
}
