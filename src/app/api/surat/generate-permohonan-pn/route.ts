import { permohonanPost } from "@/lib/server/permohonanRoute";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = permohonanPost("permohonan-eksekusi-pn");
