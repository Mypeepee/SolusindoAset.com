"use client";

import { useState } from "react";
import { suratTemplates, type SuratTemplate } from "./components/data";
import { SuratFileManager }            from "./components/SuratFileManager";
import { TemplatePermohonanEksekusi }  from "./components/TemplatePermohonanEksekusi";
import { TemplateAkteGrosse }          from "./components/TemplateAkteGrosse";
import { TemplateAktaKesepakatan }     from "./components/TemplateAktaKesepakatan";

// Map template id → which modal component to use.
// Extend this as more templates become active.
const MODAL_MAP: Record<string, "eksekusi" | "akte-grosse" | "akta-kesepakatan"> = {
  "permohonan-eksekusi-pn":    "eksekusi",
  "permohonan-akte-grosse":    "akte-grosse",
  "akta-kesepakatan-bersama":  "akta-kesepakatan",
};

export default function SuratPage() {
  const [selected, setSelected] = useState<SuratTemplate | null>(null);

  const modalType = selected ? (MODAL_MAP[selected.id] ?? null) : null;


  const handleClose  = () => setSelected(null);
  const handleSubmit = ({ template, values }: { template: SuratTemplate; values: Record<string, string> }) => {
    console.log("TEMPLATE:", template.id);
    console.log("VALUES:", values);
    setSelected(null);
  };

  return (
    <>
      <SuratFileManager
        templates={suratTemplates}
        onUseTemplate={(t) => setSelected(t)}
      />

      {/* Modal: Permohonan Eksekusi (LIT-001) */}
      <TemplatePermohonanEksekusi
        open={modalType === "eksekusi"}
        template={selected}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />

      {/* Modal: Surat Kuasa Permohonan Akte Grosse (DOK-003) */}
      <TemplateAkteGrosse
        open={modalType === "akte-grosse"}
        template={selected}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />

      {/* Modal: Akta Kesepakatan Bersama (LIT-003) */}
      <TemplateAktaKesepakatan
        open={modalType === "akta-kesepakatan"}
        template={selected}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    </>
  );
}
