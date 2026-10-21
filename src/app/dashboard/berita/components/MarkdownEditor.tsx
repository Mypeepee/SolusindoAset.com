"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Quote,
  type LucideIcon,
} from "lucide-react";
import markdownToHtml from "@/utils/markdownToHtml";
import styles from "./workspace.module.css";

const tools: {
  label: string;
  icon: LucideIcon;
  before: string;
  after: string;
  placeholder: string;
}[] = [
  {
    label: "Tebal",
    icon: Bold,
    before: "**",
    after: "**",
    placeholder: "teks tebal",
  },
  {
    label: "Miring",
    icon: Italic,
    before: "_",
    after: "_",
    placeholder: "teks miring",
  },
  {
    label: "Blok subjudul",
    icon: Heading2,
    before: "\n\n## ",
    after: "\n",
    placeholder: "Subjudul",
  },
  {
    label: "Blok daftar",
    icon: List,
    before: "\n\n- ",
    after: "\n",
    placeholder: "Poin pertama",
  },
  {
    label: "Blok kutipan",
    icon: Quote,
    before: "\n\n> ",
    after: "\n",
    placeholder: "Kutipan",
  },
  {
    label: "Tautan",
    icon: Link2,
    before: "[",
    after: "](https://example.com)",
    placeholder: "teks tautan",
  },
  {
    label: "Blok gambar",
    icon: ImagePlus,
    before: "\n\n![",
    after: "](https://example.com/gambar.jpg)\n",
    placeholder: "Deskripsi gambar",
  },
];

export default function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState("");
  useEffect(() => {
    let active = true;
    if (preview)
      markdownToHtml(value || "_Mulai menulis untuk melihat pratinjau._").then(
        (next) => {
          if (active) setHtml(next);
        },
      );
    return () => {
      active = false;
    };
  }, [preview, value]);
  const insert = (tool: (typeof tools)[number]) => {
    const element = textarea.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const text = value.slice(start, end) || tool.placeholder;
    onChange(
      value.slice(0, start) +
        tool.before +
        text +
        tool.after +
        value.slice(end),
    );
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(
        start + tool.before.length,
        start + tool.before.length + text.length,
      );
    });
  };
  return (
    <div className={styles.markdownEditor}>
      <div className={styles.editorToolbar}>
        <div role="group" aria-label="Format dan blok konten">
          {tools.map((tool) => (
            <button
              type="button"
              key={tool.label}
              title={tool.label}
              aria-label={tool.label}
              disabled={preview}
              onClick={() => insert(tool)}
            >
              <tool.icon size={16} />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={preview}
          className={preview ? styles.filterActive : ""}
          onClick={() => setPreview(!preview)}
        >
          {preview ? <Code2 size={15} /> : <Eye size={15} />}
          <span>{preview ? "Tulis" : "Pratinjau"}</span>
        </button>
      </div>
      {preview ? (
        <div
          className={`${styles.editorContentPreview} ${styles.articleBody} article-body`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <textarea
          ref={textarea}
          id="article-content"
          aria-label="Isi artikel, mendukung format Markdown"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              ["b", "i"].includes(event.key.toLowerCase())
            ) {
              event.preventDefault();
              insert(tools[event.key.toLowerCase() === "b" ? 0 : 1]);
            }
          }}
          placeholder={
            "Setiap cerita besar dimulai dari satu kalimat.\n\nTulis artikel Anda di sini…"
          }
        />
      )}
      <div className={styles.editorHint}>
        <span>
          <Code2 size={12} /> Markdown · blok judul, daftar, kutipan & media
        </span>
        <span>
          {value
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .length.toLocaleString("id-ID")}{" "}
          kata
        </span>
      </div>
    </div>
  );
}
