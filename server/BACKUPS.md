# WC 2026 Betting App — Backup & Restore Guide

## Where are backups stored?

Backups are saved on **your local computer** at:
```
C:\Users\leibo\wc2026-betting\server\backups\
```

Each file is a JSON snapshot of the entire database, named by timestamp:
```
backup_2026-06-11T14-30-00.json
backup_2026-06-11T15-30-00.json
...
```

**168 files are kept at a time** (7 days × 24 hourly backups).  
Older files are deleted automatically.

---

## When are backups created?

- **Automatically** — every hour while the server is running
- **On every server start** — one backup is always created immediately at startup
- **Manually** — from the Admin panel → 💾 Backups tab → "Backup now"

---

## How to download a backup

Open the app → Admin → 💾 Backups tab.  
Every backup listed has a **⬇ Download** button — click it to save the file to your computer.  
Keep downloaded backups somewhere safe (e.g. Google Drive, a USB drive).

---

## How to restore a backup

> ⚠️ Restoring **replaces all current data** in the database with the backup.  
> Do this only if something has gone wrong.

### Step 1 — Stop the server
Close the terminal window running `npm run dev` in the `server/` folder.

### Step 2 — Open a terminal in the server folder
```
cd C:\Users\leibo\wc2026-betting\server
```

### Step 3 — Run the restore script
```
node restore-backup.mjs backups\backup_2026-06-11T14-30-00.json
```
Replace the filename with the backup you want to restore.

The script will:
1. Show you what's in the backup (date, number of bets, users, etc.)
2. Ask you to type **YES** to confirm
3. Wipe the current database
4. Restore all data from the backup
5. Reset internal ID counters so the app works normally

### Step 4 — Start the server again
```
npm run dev
```
Everything should be back to normal.

---

## What's inside a backup file?

Each `.json` file contains:

| Table        | What it holds                                 |
|--------------|-----------------------------------------------|
| `users`      | All user accounts (passwords are hashed)      |
| `teams`      | All 48 WC teams                               |
| `players`    | Player squads (for special bet autocomplete)  |
| `matches`    | All 104 matches with scores and status        |
| `matchBets`  | Every user's prediction for every match       |
| `specialBets`| Champion / Top Scorer / Top Assists picks     |
| `bonusLogs`  | Bonus points (exact score bonus, round bonus) |

---

## Restoring from a downloaded file

If you downloaded a backup via the Admin panel and need to restore from it:

1. Copy the downloaded `.json` file into `server\backups\`
2. Follow the restore steps above using that filename

---

## FAQ

**Q: What if the server crashes mid-tournament and I lose the backups folder?**  
A: Download backups regularly via Admin → Backups → ⬇ Download and store them on Google Drive, OneDrive, or a USB drive. The app creates one every hour, so at most 1 hour of data would be lost.

**Q: Can I restore onto a fresh install?**  
A: Yes. Set up the project normally (`npx prisma db push` to create the schema), then run the restore script before starting the server.

**Q: Will restoring affect the WC match schedule?**  
A: No — match data is in the backup too. The server will re-sync from the football API on next startup, but your bets and scores are fully restored from the backup.
