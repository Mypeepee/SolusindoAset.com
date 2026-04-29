import { MapPin } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { capitalize, formatDate, getLocation } from "./utils";
import { DataRow, SectionCard } from "./shared";

export default function AssetFactsCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const locationFull = getLocation(project);

  return (
    <SectionCard
      eyebrow="Asset Facts"
      title="Data dasar aset"
      icon={<MapPin className="h-5 w-5" />}
    >
      <DataRow label="ID project" value={project.id} />
      <DataRow label="ID listing" value={String(project.listingId ?? "—")} />
      <DataRow label="Jenis pendanaan" value={capitalize(project.fundingType)} />
      <DataRow label="Tanggal pembelian" value={formatDate(project.purchaseDate)} />
      <DataRow label="Mulai project" value={formatDate(project.startDate)} />
      <DataRow
        label="Estimasi selesai"
        value={formatDate(project.estimatedFinish)}
      />
      <DataRow
        label="Pendanaan ditutup"
        value={formatDate(project.fundingClosedAt)}
      />
      <DataRow label="Wilayah" value={locationFull || "—"} />
      <DataRow label="Alamat" value={project.address || "—"} />
      <DataRow
        label="Dibuat oleh"
        value={project.createdByName ?? project.createdById ?? "—"}
      />
      <DataRow label="Diupdate" value={formatDate(project.updatedAt)} />
    </SectionCard>
  );
}