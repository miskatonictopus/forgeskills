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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

type Props = {
  valueHtml: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange: (html: string, plain: string) => void;
};

const FONT_SIZES = ["12px","14px","16px","18px","20px","24px","28px","32px"];

// Debounce ligero para evitar tormenta de renders al pegar
const useDebounced = (fn: (...a: any[]) => void, ms = 150) => {
  const t = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  return React.useCallback((...args: any[]) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), ms);
  }, [fn, ms]);
};

export default function TiptapEditor({
  valueHtml,
  placeholder = "Escribe la descripción...",
  disabled,
  className,
  onChange,
}: Props) {
  const lastHtmlRef = React.useRef<string>("");
  const debouncedOnChange = useDebounced((html: string, text: string) => onChange(html, text), 120);

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
        Link.configure({ openOnClick: false, autolink: true, protocols: ["http","https","mailto"] }),
        Placeholder.configure({ placeholder }),
        FontSize,
      ],
      // Evita hydration mismatch
      content: "",                 // ← vacío; cargamos valueHtml tras montar
      immediatelyRender: false,    // ← clave en Next
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        lastHtmlRef.current = html;                 // recordamos lo último emitido por el editor
        debouncedOnChange(html, editor.getText());  // emitimos con debounce (pegar = OK)
      },
    },
    [] // ← no reinstanciar en cada render
  );

  // Cambiar editabilidad sin reinstanciar
  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // Cargar el valor inicial al montar el editor
  React.useEffect(() => {
    if (!editor) return;
    if (valueHtml && valueHtml !== lastHtmlRef.current) {
      editor.commands.setContent(valueHtml, { emitUpdate: false });
      lastHtmlRef.current = valueHtml;
    }
  }, [editor]); // ← solo al montar

  // Sincronizar cuando valueHtml CAMBIE de verdad desde fuera (evita bucle)
  React.useEffect(() => {
    if (!editor) return;
    if (!valueHtml) return;
    if (valueHtml === lastHtmlRef.current) return;     // es lo que acabamos de emitir → no tocar
    const current = editor.getHTML();
    if (valueHtml !== current) {
      editor.commands.setContent(valueHtml, { emitUpdate: false });
      lastHtmlRef.current = valueHtml;
    }
  }, [valueHtml, editor]);

  if (!editor) return null;

  const currentSize = (editor.getAttributes("fontSize")?.size as string | undefined) ?? "";

  const Btn = ({ onClick, active, children, title }: any) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8"
      disabled={disabled}
    >
      {children}
    </Button>
  );

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-t-md border border-input bg-background px-3 py-2 overflow-x-auto">
        <Btn title="Negrita"   active={editor.isActive("bold")}      onClick={() => editor.chain().focus().toggleBold().run()}>B</Btn>
        <Btn title="Cursiva"   active={editor.isActive("italic")}    onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="Subrayado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Btn title="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn title="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Btn title="Lista"    active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
        <Btn title="Ordenada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Tamaño */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tamaño</span>
          <Select
            value={currentSize || "16px"}
            onValueChange={(v) => (v === "reset" ? editor.chain().focus().unsetFontSize().run() : editor.chain().focus().setFontSize(v).run())}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 min-w-[110px]">
              <SelectValue placeholder="16px" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {FONT_SIZES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              <SelectItem value="reset">Reset</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />
        <Btn title="Cita"   active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&quot;</Btn>
        <Btn title="Código" active={editor.isActive("code")}       onClick={() => editor.chain().focus().toggleCode().run()}>{`</>`}</Btn>

        <Separator orientation="vertical" className="mx-1 h-6" />
        <Btn title="Limpiar" active={false} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear</Btn>
      </div>

      {/* Editor: borde/scroll en el wrapper; .ProseMirror sin overflow/border */}
      <div className="mt-3 rounded-md border border-input bg-background">
        <EditorContent
          editor={editor}
          className={`
            min-h-[420px] p-4 leading-relaxed outline-none
            [&_.ProseMirror]:min-h-[420px]
            [&_.ProseMirror]:outline-none
            [&_.ProseMirror_p]:m-0
            [&_.ProseMirror_ul]:my-2
            [&_.ProseMirror_ol]:my-2
          `}
        />
      </div>
    </div>
  );
}
