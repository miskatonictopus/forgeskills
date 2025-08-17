import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /** Aplica tamaño (ej. "18px", "1.25rem") a la selección */
      setFontSize: (size: string) => ReturnType;
      /** Elimina tamaño de fuente personalizado */
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Mark.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"], // no imprescindible, pero mantiene coherencia con otras marks
    };
  },

  addAttributes() {
    return {
      size: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: { size?: string | null }) =>
          attrs?.size ? { style: `font-size: ${attrs.size}` } : {},
      },
    };
  },

  parseHTML() {
    return [{ style: "font-size" }];
  },

  renderHTML({ HTMLAttributes }) {
    // usa <span> con style inline para preservar en PDF
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { size }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
