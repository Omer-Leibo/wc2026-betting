import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Backups land in  server/backups/  (next to src/)
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 168;           // 7 days × 24 hourly backups
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let backupHandle: NodeJS.Timeout | null = null;

// ─── Core export ─────────────────────────────────────────────────────────────

export async function runBackup(): Promise<string> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Pull every table that matters
  const [users, teams, players, matches, matchBets, specialBets, bonusLogs] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.team.findMany(),
      prisma.player.findMany(),
      prisma.match.findMany(),
      prisma.matchBet.findMany(),
      prisma.specialBet.findMany(),
      prisma.bonusLog.findMany(),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    counts: {
      users:       users.length,
      teams:       teams.length,
      players:     players.length,
      matches:     matches.length,
      matchBets:   matchBets.length,
      specialBets: specialBets.length,
      bonusLogs:   bonusLogs.length,
    },
    data: { users, teams, players, matches, matchBets, specialBets, bonusLogs },
  };

  // e.g. backup_2026-06-11T14-30-00.json
  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${ts}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf8');

  // Prune — keep only the newest MAX_BACKUPS files
  const existing = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .sort(); // ISO timestamp sort = chronological

  if (existing.length > MAX_BACKUPS) {
    existing.slice(0, existing.length - MAX_BACKUPS)
      .forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  }

  const kb = Math.round(fs.statSync(filepath).size / 1024);
  console.log(`[Backup] ✓ ${filename}  (${kb} KB — ${matchBets.length} bets, ${users.length} users)`);
  return filepath;
}

// ─── List recent backups ──────────────────────────────────────────────────────

export interface BackupMeta {
  filename: string;
  createdAt: string;
  sizeKb: number;
}

export function listBackups(): BackupMeta[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .sort()
    .reverse() // newest first
    .slice(0, 20) // show last 20 in UI
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        createdAt: stat.mtime.toISOString(),
        sizeKb: Math.round(stat.size / 1024),
      };
    });
}

export function getBackupPath(filename: string): string | null {
  // Sanitise — only allow simple backup filenames, no path traversal
  if (!/^backup_[\d\-T]+\.json$/.test(filename)) return null;
  const p = path.join(BACKUP_DIR, filename);
  return fs.existsSync(p) ? p : null;
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

export function startBackupScheduler(): void {
  // One backup immediately on start-up, then every hour
  runBackup().catch(err => console.error('[Backup] Initial backup failed:', err));

  backupHandle = setInterval(() => {
    runBackup().catch(err => console.error('[Backup] Scheduled backup failed:', err));
  }, INTERVAL_MS);

  const hours = INTERVAL_MS / 3_600_000;
  console.log(`[Backup] Scheduler started — every ${hours}h, keeping last ${MAX_BACKUPS} files`);
}

export function stopBackupScheduler(): void {
  if (backupHandle) { clearInterval(backupHandle); backupHandle = null; }
}
