export declare function runBackup(): Promise<string>;
export interface BackupMeta {
    filename: string;
    createdAt: string;
    sizeKb: number;
}
export declare function listBackups(): BackupMeta[];
export declare function getBackupPath(filename: string): string | null;
export declare function startBackupScheduler(): void;
export declare function stopBackupScheduler(): void;
//# sourceMappingURL=backupService.d.ts.map