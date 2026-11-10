export type DrivePurpose = "properties" | "agents" | "attachments";
export type DriveAccount = {
  id: string; label: string; clientId: string; clientSecret: string; refreshToken: string;
  roots: Record<DrivePurpose, string | null>;
};
export type DriveStatus = {
  id: string; label: string; email: string | null; connected: boolean; error: string | null;
  storage: { limit?: string; usage?: string; usageInDrive?: string; usageInDriveTrash?: string } | null;
};
export type DriveUpload = {
  buffer: Buffer; name: string; mimeType: string; purpose?: DrivePurpose;
  folders?: string[]; publicRead?: boolean; primaryParent?: string | null;
};
export type DrivePool = {
  upload: (input: DriveUpload) => Promise<{ fileId: string; accountId: string; url: string }>;
  accounts: () => Promise<DriveAccount[]>;
  status: () => Promise<DriveStatus[]>;
  getFileInfo: (fileId: string) => Promise<Record<string, unknown>>;
  deleteFile: (fileId: string) => Promise<unknown>;
};
export const DRIVE_LEGACY_FOLDERS: Record<DrivePurpose, string>;
export class DriveUploadError extends Error {
  status: number; reason: string; accountId: string; committed: boolean;
  constructor(message: string, options?: { status?: number; reason?: string; accountId?: string; committed?: boolean });
}
export function environmentDriveAccounts(env?: NodeJS.ProcessEnv): DriveAccount[];
export function createDrivePool(options?: {
  accounts?: () => DriveAccount[] | Promise<DriveAccount[]>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sharedCache?: { tokens: Map<string, unknown>; folders: Map<string, unknown>; quota: Map<string, unknown> };
}): DrivePool;
