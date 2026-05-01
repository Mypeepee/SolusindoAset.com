"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { suratTemplates, type SuratTemplate } from "./components/data";
import { SuratTemplateList } from "./components/SuratTemplateList";
import { SuratTemplateModal } from "./components/SuratTemplateModal";

function SuratContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const [selectedTemplate, setSelectedTemplate] = useState<SuratTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SuratTemplate | null>(null);

  // Auto-buka modal jika datang dari global search
  useEffect(() => {
    if (!templateId) return;
    const match = suratTemplates.find((t) => t.id === templateId);
    if (match) setSelectedTemplate(match);
  }, [templateId]);

  return (
    <div className="space-y-6">
      <SuratTemplateList
        templates={suratTemplates}
        onUseTemplate={(template) => setSelectedTemplate(template)}
        onPreviewTemplate={(template) => setPreviewTemplate(template)}
      />

      <SuratTemplateModal
        open={Boolean(selectedTemplate)}
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onSubmit={({ template, values }) => {
          console.log("TEMPLATE DIPILIH:", template);
          console.log("VALUES:", values);
          setSelectedTemplate(null);
        }}
      />

      {previewTemplate && (
        <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-5 text-slate-200">
          <p className="text-sm text-slate-400">Preview template</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{previewTemplate.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">{previewTemplate.description}</p>
        </div>
      )}
    </div>
  );
}

export default function SuratPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <SuratContent />
    </Suspense>
  );
}
