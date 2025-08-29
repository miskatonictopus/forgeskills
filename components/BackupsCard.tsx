// BackupsCard.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`;

export default function BackupsCard() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const res = await (window as any).electronAPI.invoke("backup:list");
    if (res?.ok) setRows(res.list);
  };
  useEffect(() => { load(); }, []);

  const run = async (kind: "INC" | "FULL") => {
    const res = await (window as any).electronAPI.invoke("backup:now", kind);
    if (res?.ok) {
      toast.success(`Backup ${res.info.kind} creado`);
      load();
    } else {
      toast.error(res?.error ?? "No se pudo crear el backup.");
    }
  };

  const restore = async (file: string) => {
    if (!confirm("¿Restaurar esta copia? Sustituirá la base de datos actual.")) return;
    const res = await (window as any).electronAPI.invoke("backup:restore", file);
    if (res?.ok) toast.success("Base de datos restaurada. Reinicia si es necesario.");
    else toast.error(res?.error ?? "No se pudo restaurar.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups de base de datos</CardTitle>
        <CardDescription>Incrementales cada 20’ y completos cada hora.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => run("INC")}>Hacer backup ahora (INC)</Button>
          <Button variant="secondary" onClick={() => run("FULL")}>Hacer backup completo</Button>
        </div>

        <Separator />

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.file}>
                  <TableCell className="font-mono">{r.ts.replace("_", " ")}</TableCell>
                  <TableCell>{r.kind}</TableCell>
                  <TableCell>{fmtBytes(r.size)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => restore(r.file)}>Restaurar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
