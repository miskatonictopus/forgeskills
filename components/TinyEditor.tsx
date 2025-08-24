"use client";

import { useEffect, useRef, useState, useId } from "react";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@tinymce/tinymce-react").then(m => m.Editor), { ssr: false });

type TinyEditorProps = {
  value: string;
  onChange: (html: string, plainText?: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  placeholder?: string;
  readOnly?: boolean;
  height?: number;
  autoresize?: boolean;
  forceLight?: boolean;
};

export default function TinyEditor({
  value,
  onChange,
  onDirtyChange,
  placeholder = "Escribe aquí…",
  readOnly = false,
  height,
  autoresize = true,
  forceLight,
}: TinyEditorProps) {
  const uid = useId().replace(/[:]/g, "");
  const uiId = `tiny-ui-${uid}`;
  const editorRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = forceLight
    ? false
    : typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  if (!mounted) return null;

  return (
    <div id={uiId} className="relative z-[60]"> {/* wrapper con z alto */}
      <style>{`
        /* Asegura menús por encima y con eventos activos */
        .tox, .tox-tinymce-aux, .tox-dialog, .tox-menu { z-index: 9999 !important; pointer-events: auto !important; }
      `}</style>

      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        onInit={(_evt, editor) => (editorRef.current = editor)}
        value={value}
        onEditorChange={(content, editor) => {
          const plain = editor?.getContent({ format: "text" }) ?? "";
          onChange(content, plain);
        }}
        disabled={readOnly}
        init={{
          /* monta menús y popovers dentro del wrapper */
          ui_container: `#${uiId}`,

          skin: isDark ? "oxide-dark" : "oxide",
          content_css: isDark ? "dark" : "default",

          content_style: `
            :root { --sf-editor-bg:#fff; --sf-editor-fg:#111827; }
            html,body{height:100%}
            body{
              background:var(--sf-editor-bg);
              color:var(--sf-editor-fg);
              margin:0!important;
              padding:24px!important;
              line-height:1.65;
              font-size:15px;
            }
            p{margin:0 0 .8em}
            strong,b{font-weight:700}
            em,i{font-style:italic}
            u{text-decoration:underline}
            a{text-decoration:underline; color:#2563eb}
            ul,ol{margin:0 0 .8em 1.5em; padding-left:1.25rem}
            ul{list-style:disc}
            ol{list-style:decimal}
            li{margin:.2em 0}
            h1,h2,h3,h4,h5,h6{margin:1.2em 0 .6em; font-weight:700}
            h1{font-size:2rem}
            h2{font-size:1.75rem}
            h3{font-size:1.5rem}
            h4{font-size:1.25rem; font-weight:600}
            h5{font-size:1.125rem; font-weight:600}
            h6{font-size:.95rem; font-weight:600; text-transform:uppercase; letter-spacing:.02em}
            blockquote{border-left:4px solid #e5e7eb; padding-left:12px; color:#374151}
            pre{background:#0b10211a; padding:12px; border-radius:8px; overflow:auto}
            code,kbd,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
            hr{border:0; border-top:1px solid #e5e7eb; margin:1rem 0}
            table{border-collapse:collapse; width:100%}
            table,th,td{border:1px solid #e5e7eb}
            th,td{padding:8px}
            img{max-width:100%; height:auto}
            .mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before{color:#9ca3af; opacity:1}
          `,

          height: height ?? (autoresize ? 320 : 480),
          min_height: autoresize ? 220 : undefined,
          resize: true,
          menubar: false,
          toolbar_sticky: true,
          branding: false,

          plugins: [
            "autolink","lists","link","image","charmap","preview","anchor",
            "searchreplace","visualblocks","code","fullscreen",
            "insertdatetime","media","table","help","wordcount",
            "autoresize","autosave","advlist","codesample"
          ],

          /* sin quickbars (nada de ventana flotante) */
          quickbars_selection_toolbar: false as any,
          quickbars_insert_toolbar: false as any,

          toolbar: [
            "undo redo | blocks fontfamily fontsize | bold italic underline forecolor backcolor |",
            "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent |",
            "table link image media codesample | removeformat | code preview fullscreen"
          ].join(" "),

          block_formats:
            "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6; Quote=blockquote; Preformatted=pre",

          placeholder,
          browser_spellcheck: true,
          contextmenu: false,
          autosave_interval: "3s",
          autosave_retention: "30m",
          autosave_restore_when_empty: true,
          autoresize_bottom_margin: 24,
          statusbar: true,

          setup: (editor) => {
            editor.on("Dirty", () => onDirtyChange?.(true));
            editor.on("SaveContent", () => onDirtyChange?.(false));
            editor.on("Change KeyUp Undo Redo SetContent", () =>
              onDirtyChange?.(!!editor.isDirty())
            );
          },
        }}
      />
    </div>
  );
}
