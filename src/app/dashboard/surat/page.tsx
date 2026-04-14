"use client";

import { useState } from "react";
import { suratTemplates, type SuratTemplate } from "./components/data";
import { SuratTemplateList } from "./components/SuratTemplateList";
import { TemplatePermohonanEksekusi } from "./components/TemplatePermohonanEksekusi";

export default function SuratPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<SuratTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SuratTemplate | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-slate-800 bg-slate-950/80 p-6 shadow-[0_20px_70px_-30px_rgba(16,185,129,0.12)] backdrop-blur-xl">
        <SuratTemplateList
          templates={suratTemplates}
          onUseTemplate={(template) => setSelectedTemplate(template)}
          onPreviewTemplate={(template) => setPreviewTemplate(template)}
        />
      </div>

      <TemplatePermohonanEksekusi
        open={Boolean(selectedTemplate)}
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onSubmit={({ template, values }) => {
          console.log("TEMPLATE DIPILIH:", template);
          console.log("VALUES:", values);
          setSelectedTemplate(null);
        }}
      />

      {previewTemplate ? (
        <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-5 text-slate-200">
          <p className="text-sm text-slate-400">Preview template</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {previewTemplate.title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            {previewTemplate.description}
          </p>
        </div>
      ) : null}
    </div>
  );
}
