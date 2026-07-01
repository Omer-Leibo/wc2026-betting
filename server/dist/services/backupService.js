"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackup = runBackup;
exports.listBackups = listBackups;
exports.getBackupPath = getBackupPath;
exports.startBackupScheduler = startBackupScheduler;
exports.stopBackupScheduler = stopBackupScheduler;
const prisma_1 = require("../lib/prisma");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Backups land in  server/backups/  (next to src/)
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 168; // 7 days × 24 hourly backups
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let backupHandle = null;
// ─── Core export ─────────────────────────────────────────────────────────────
async function runBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    // Pull every table that matters
    const [users, teams, players, matches, matchBets, specialBets, bonusLogs] = await Promise.all([
        prisma_1.prisma.user.findMany(),
        prisma_1.prisma.team.findMany(),
        prisma_1.prisma.player.findMany(),
        prisma_1.prisma.match.findMany(),
        prisma_1.prisma.matchBet.findMany(),
        prisma_1.prisma.specialBet.findMany(),
        prisma_1.prisma.bonusLog.findMany(),
    ]);
    const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        counts: {
            users: users.length,
            teams: teams.length,
            players: players.length,
            matches: matches.length,
            matchBets: matchBets.length,
            specialBets: specialBets.length,
            bonusLogs: bonusLogs.length,
        },
        data: { users, teams, players, matches, matchBets, specialBets, bonusLogs },
    };
    // e.g. backup_2026-06-11T14-30-00.json
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
function listBackups() {
    if (!fs.existsSync(BACKUP_DIR))
        return [];
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
function getBackupPath(filename) {
    // Sanitise — only allow simple backup filenames, no path traversal
    if (!/^backup_[\d\-T]+\.json$/.test(filename))
        return null;
    const p = path.join(BACKUP_DIR, filename);
    return fs.existsSync(p) ? p : null;
}
// ─── Scheduler ───────────────────────────────────────────────────────────────
function startBackupScheduler() {
    // One backup immediately on start-up, then every hour
    runBackup().catch(err => console.error('[Backup] Initial backup failed:', err));
    backupHandle = setInterval(() => {
        runBackup().catch(err => console.error('[Backup] Scheduled backup failed:', err));
    }, INTERVAL_MS);
    const hours = INTERVAL_MS / 3600000;
    console.log(`[Backup] Scheduler started — every ${hours}h, keeping last ${MAX_BACKUPS} files`);
}
function stopBackupScheduler() {
    if (backupHandle) {
        clearInterval(backupHandle);
        backupHandle = null;
    }
}
//# sourceMappingURL=backupService.js.map