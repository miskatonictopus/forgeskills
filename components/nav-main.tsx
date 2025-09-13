"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type SubItem = { title: string; url: string; id?: string; color?: string };
type Item = { title: string; url: string; icon?: LucideIcon; isActive?: boolean; items?: SubItem[] };

function normalizeHex(v?: string) {
  if (!v) return "";
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}
const slim = (id: string) => id.replace(/^0+/, "");
function asigIdFromUrl(u?: string) {
  if (!u) return "";
  const ps = u.split("?")[0].split("/").filter(Boolean);
  const i = ps.findIndex((p) => p === "asignaturas");
  const seg = i >= 0 ? ps[i + 1] : ps[ps.length - 1];
  if (!seg) return "";
  const m = seg.match(/^\d+/);
  return m ? m[0] : seg;
}

export function NavMain({ items }: { items: Item[] }) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const fetchedOnce = useRef(false);

  // clave estable de items → para detectar cambios de subitems
  const itemsKey = useMemo(
    () => JSON.stringify(items.map(it => ({ u: it.url, s: (it.items ?? []).map(si => si.id ?? si.url) }))),
    [items]
  );

  // 1) Hidrata TODO desde SQLite una vez (persistencia garantizada)
  useEffect(() => {
    (async () => {
      if (fetchedOnce.current) return;
      fetchedOnce.current = true;
      try {
        const api = (window as any).electronAPI;
        const rows = await api?.listarColoresAsignaturas?.(); // [{id, color}]
        const map: Record<string,string> = {};
        for (const r of rows ?? []) {
          const hex = normalizeHex(r?.color);
          if (!hex) continue;
          const id = String(r.id);
          map[id] = hex;         // con ceros
          map[slim(id)] = hex;   // alias sin ceros
        }
        if (Object.keys(map).length) setColors(map);
      } catch {}
    })();
  }, []);

  // 2) Si falta algún color para subitems actuales, lo pedimos “on demand”
  useEffect(() => {
    (async () => {
      const api = (window as any).electronAPI;
      const missing: string[] = [];
      for (const it of items) {
        for (const s of it.items ?? []) {
          const id = s.id || asigIdFromUrl(s.url);
          if (!id || s.color) continue;
          if (!colors[id] && !colors[slim(id)]) missing.push(id);
        }
      }
      if (!missing.length) return;
      for (const id of missing) {
        try {
          const det = await (api?.leerAsignatura?.(id) ?? api?.getAsignatura?.(id));
          const hex = normalizeHex(det?.color);
          if (hex) {
            setColors(prev => ({ ...prev, [id]: hex, [slim(id)]: hex }));
          }
        } catch {}
      }
    })();
  }, [itemsKey, colors]);

  // 3) Escucha cambios en vivo (cuando cambias color en otra vista)
  useEffect(() => {
    const onColor = (e: any) => {
      const { asignaturaId, color } = e?.detail || {};
      const id = String(asignaturaId || "");
      const hex = normalizeHex(color);
      if (!id || !hex) return;
      setColors(prev => ({ ...prev, [id]: hex, [slim(id)]: hex }));
    };
    window.addEventListener("asignatura:color:actualizado", onColor);
    return () => window.removeEventListener("asignatura:color:actualizado", onColor);
  }, []);

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon;

          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} className="gap-2 justify-start group-data-[collapsible=icon]:justify-center">
                  <a href={item.url} className="flex items-center">
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="ml-2 group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} className="gap-2 justify-start group-data-[collapsible=icon]:justify-center">
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="ml-2 group-data-[collapsible=icon]:hidden">{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                  <SidebarMenuSub>
                    {(item.items ?? []).map((sub) => {
                      const id = sub.id || asigIdFromUrl(sub.url);
                      const fromProp = normalizeHex(sub.color);
                      const fromMap  = id ? (colors[id] || colors[slim(id)]) : "";
                      const bullet   = fromProp || fromMap || "";
                      return (
                        <SidebarMenuSubItem key={`${sub.title}-${sub.url}`}>
                          <SidebarMenuSubButton asChild>
                            <a href={sub.url} className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full border border-zinc-600"
                                style={{ backgroundColor: bullet || "transparent" }}
                                title={bullet || "Sin color"}
                              />
                              <span>{sub.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
