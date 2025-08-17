"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { FontSize } from "@/components/tiptap/extensions/font-size";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  valueHtml: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange: (html: string, plain: string) => void;
};

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

export default function TiptapEditor({
  valueHtml,
  placeholder = "Escribe la descripción...",
  disabled,
  className,
  onChange,
}: Props) {
  const [tick, setTick] = React.useState(0); // fuerza re-render en cambios de selección

  const editor = useEditor(
    {
      editable: !disabled,
      extensions: [
        StarterKit.configure({
          bulletList: { keepMarks: true, keepAttributes: true },
          orderedList: { keepMarks: true, keepAttributes: true },
          codeBlock: false,
        }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] }),
        Placeholder.configure({ placeholder }),
        FontSize, // tamaño de fuente
      ],
      content: valueHtml || "<p></p>",
      onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
      immediatelyRender: false,
    },
    [disabled, placeholder]
  );

  // limpia al desmontar
  React.useEffect(() => () => editor?.destroy(), [editor]);

  // sincroniza contenido externo sin disparar onUpdate
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (valueHtml && valueHtml !== current) {
      editor.commands.setContent(valueHtml, { emitUpdate: false });
    }
  }, [valueHtml, editor]);

  // re-render cuando cambia la selección (para refrescar el valor del Select)
  React.useEffect(() => {
    if (!editor) return;
    const update = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor) return null;

  // lee tamaño activo de la selección
  const currentSize =
    (editor.getAttributes("fontSize")?.size as string | undefined) ?? "";

  const Btn = ({ onClick, active, children, title }: any) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8"
    >
      {children}
    </Button>
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 rounded-t border px-3 py-2 bg-background overflow-x-auto">
        <Btn title="Negrita"  active={editor.isActive("bold")}      onClick={() => editor.chain().focus().toggleBold().run()}>B</Btn>
        <Btn title="Cursiva"  active={editor.isActive("italic")}    onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="Subrayado"active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />
        <Btn title="H1"       active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn title="H2"       active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />
        <Btn title="Lista"    active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
        <Btn title="Ordenada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Selector de tamaño con shadcn */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tamaño</span>
          <Select
  value={currentSize || "16px"}
  onValueChange={(v) => {
    if (v === "reset") editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(v).run();
  }}
>
  <SelectTrigger className="h-8 min-w-[110px]">
    <SelectValue placeholder="16px" />
  </SelectTrigger>
  <SelectContent className="z-50">
    {FONT_SIZES.map((s) => (
      <SelectItem key={s} value={s}>
        {s}
      </SelectItem>
    ))}
    <SelectItem value="reset">Reset</SelectItem>
  </SelectContent>
</Select>
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />
        <Btn title="Cita"     active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&quot;</Btn>
        <Btn title="Código"   active={editor.isActive("code")}       onClick={() => editor.chain().focus().toggleCode().run()}>{`</>`}</Btn>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Btn title="Limpiar"  active={false} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear</Btn>
      </div>

      <EditorContent
        editor={editor}
        className="
          max-w-none
          min-h-[420px]
          [&_.ProseMirror]:min-h-[420px]
          [&_.ProseMirror]:max-h-[70vh]
          [&_.ProseMirror]:overflow-y-auto
          [&_.ProseMirror]:p-4
          [&_.ProseMirror]:leading-relaxed
          [&_.ProseMirror]:outline-none
          [&_.ProseMirror_p]:m-0
          [&_.ProseMirror_ul]:my-2
          [&_.ProseMirror_ol]:my-2
        "
      />
    </div>
  );
}
