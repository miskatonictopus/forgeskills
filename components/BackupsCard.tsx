// BackupsCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { toast } from "sonner";

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

type BackupRow = {
  file: string;    // ruta o nombre del fichero
  ts: string;      // "YYYY-MM-DD HH-mm"
  kind: "INC" | "FULL";
  size: number;    // bytes
};

export default function BackupsCard() {
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    const res = await (window as any).electronAPI.invoke("backup:list");
    if (res?.ok) {
      setRows(res.list as BackupRow[]);
      // Mantén selección si siguen existiendo
      setSelected((prev) => {
        const next = new Set<string>();
        for (const r of res.list as BackupRow[]) if (prev.has(r.file)) next.add(r.file);
        return next;
      });
    }
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (kind: "INC" | "FULL") => {
    const res = await (window as any).electronAPI.invoke("backup:now", kind);
    if (res?.ok) {
      toast.success(`Backup ${res.info.kind} creado`);
      await load();
    } else {
      toast.error(res?.error ?? "No se pudo crear el backup.");
    }
  };

  const restore = async (file: string) => {
    if (!confirm("¿Restaurar esta copia? Sustituirá la base de datos actual.")) return;
    const res = await (window as any).electronAPI.invoke("backup:restore", file);
    if (res?.ok) {
      toast.success("Base de datos restaurada. Reinicia si es necesario.");
    } else {
      toast.error(res?.error ?? "No se pudo restaurar.");
    }
  };

  const allIds = useMemo(() => rows.map((r) => r.file), [rows]);
  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && selectedCount === rows.length;
  const someSelected = selectedCount > 0 && selectedCount < rows.length;

  const toggleAll = (checked: CheckedState) => {
    if (checked) {
      setSelected(new Set(allIds));
    } else {
      setSelected(new Set());
    }
  };

  const toggleOne = (file: string, checked: CheckedState) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(file);
      else next.delete(file);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Eliminar ${selected.size} backup(s) seleccionados? Esta acción no se puede deshacer.`)) return;

    const files = Array.from(selected);

    // 1) Intento batch
    let ok = false;
    try {
      const res = await (window as any).electronAPI.invoke("backup:deleteMany", files);
      ok = !!res?.ok;
    } catch {
      ok = false;
    }

    // 2) Fallback uno a uno
    if (!ok) {
      let errors = 0;
      for (const f of files) {
        try {
          const r = await (window as any).electronAPI.invoke("backup:delete", f);
          if (!r?.ok) errors++;
        } catch {
          errors++;
        }
      }
      if (errors === 0) ok = true;
      else toast.error(`Algunas copias no se pudieron eliminar (${errors}).`);
    }

    if (ok) {
      toast.success("Copias eliminadas.");
      setSelected(new Set());
      await load();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-xs">Las backups se alojan en tu equipo local<br/>Windows: Mis Documentos // MacOs: Documents</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
  <Button
    onClick={() => run("INC")}
    className="w-full min-h-10 whitespace-normal break-words text-left normal-case leading-tight text-xs"
  >
    Hacer backup ahora (INC)
  </Button>

  <Button
    variant="secondary"
    onClick={() => run("FULL")}
    className="w-full min-h-10 whitespace-normal break-words text-left normal-case leading-tight text-xs"
  >
    Hacer backup completo
  </Button>

  <Button
    variant="destructive"
    disabled={selectedCount === 0}
    onClick={deleteSelected}
    className="w-full min-h-10 whitespace-normal break-words text-left normal-case leading-tight text-xs"
  >
    Eliminar seleccionados ({selectedCount})
  </Button>
</div>

        <Separator />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-10 text-xs">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((r) => {
                const isChecked = selected.has(r.file);
                return (
                  <TableRow key={r.file} className={isChecked ? "bg-muted/40" : undefined}>
                    <TableCell className="w-10">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(c) => toggleOne(r.file, c)}
                        aria-label={`Seleccionar ${r.ts}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{r.ts.replace("_", " ")}</TableCell>
                    <TableCell className="text-xs">{r.kind}</TableCell>
                    <TableCell className="text-xs">{fmtBytes(r.size)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button className="text-xs" variant="outline" onClick={() => restore(r.file)}>
                          Restaurar
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs"
                          variant="ghost"
                          onClick={async () => {
                            setSelected(new Set([r.file]));
                            await deleteSelected();
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No hay backups aún.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
