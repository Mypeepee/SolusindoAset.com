import "server-only";
import { createDrivePool } from "./googleDrivePool.mjs";

/** Server-configured Drive 1 → Drive 2 storage fallback for every upload route. */
export const googleDrive = createDrivePool();
