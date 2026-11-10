import dotenv from 'dotenv';
import { createDrivePool } from '../src/lib/server/googleDrivePool.mjs';

dotenv.config({ path: '.env.local', override: false, quiet: true });
dotenv.config({ quiet: true });

try {
  const pool = createDrivePool();
  const accounts = await pool.status();
  console.log(JSON.stringify({
    configuredAccounts: accounts.length,
    accounts: accounts.map(account => ({
      ...account,
      remainingBytes: account.storage?.limit != null && account.storage?.usage != null
        ? String(BigInt(account.storage.limit) > BigInt(account.storage.usage) ? BigInt(account.storage.limit) - BigInt(account.storage.usage) : 0n) : null,
    })),
  }, null, 2));
  if (!accounts.length || accounts.some(account => !account.connected)) process.exitCode = 1;
} catch {
  console.error('Konfigurasi Google Drive belum dapat diperiksa. Periksa environment variable server.');
  process.exitCode = 1;
}
