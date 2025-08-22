// components/editor/InlineTiptapNoFlash.tsx
"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";

type Props = {
  initialHtml: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange: (html: string, plain: string) => void;
};

export default function InlineTiptapNoFlash({
  initialHtml,
  placeholder = "Escribe aquí…",
  disabled,
  className,
  onChange,
}: Props) {
  const [ready, setReady] = React.useState(false);

  const editor = useEditor({
    editable: !disabled,
    content: initialHtml || "<p></p>",
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    onCreate: () => setReady(true),
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
    immediatelyRender: false,
  });

  // Evita fugas
  React.useEffect(() => () => editor?.destroy(), [editor]);

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      {/* Skeleton hasta que TipTap esté listo */}
      {!ready && (
        <div className="h-[420px] p-4 leading-relaxed animate-pulse" aria-hidden />
      )}
      <EditorContent
        editor={editor}
        className={cn(
          "min-h-[420px] max-h-[70vh] overflow-y-auto p-4 leading-relaxed outline-none",
          ready ? "block" : "hidden"
        )}
      />
    </div>
  );
}
