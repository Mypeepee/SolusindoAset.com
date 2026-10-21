/** Shared policy; write endpoints still resolve the current position from the database. */
export function beritaPermissions(position?: string | null) {
  const role = String(position || "").toUpperCase();
  return {
    canEdit: ["OWNER", "ADMIN", "PRINCIPAL"].includes(role),
    canPublish: role === "OWNER",
    canDelete: role === "OWNER",
    canAssignRoles: role === "OWNER",
  };
}

export const BERITA_STATUS_LABEL = {
  PUBLISHED: "Terbit",
  DRAFT: "Draf",
  SCHEDULED: "Terjadwal",
  ARCHIVED: "Arsip",
} as const;
