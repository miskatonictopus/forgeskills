"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  titulo: string;
  advertencia: string;
  textoConfirmacion: string;
  onConfirm: () => void;
};

export function FlujoSeguro({
  titulo,
  advertencia,
  textoConfirmacion,
  onConfirm,
}: Props) {
  const [faseConfirmacion, setFaseConfirmacion] = useState(false);
  const [input, setInput] = useState("");

  return (
    <>
      {!faseConfirmacion ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="w-auto uppercase font-light text-xs"
            >
              {titulo}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>{advertencia}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setFaseConfirmacion(true);
                }}
              >
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Dialog open onOpenChange={() => setFaseConfirmacion(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirma escribiendo: {textoConfirmacion}</DialogTitle>
            </DialogHeader>
            <Input
              placeholder={textoConfirmacion}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="mt-2"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setFaseConfirmacion(false);
                  setInput("");
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={input !== textoConfirmacion}
                onClick={() => {
                  setFaseConfirmacion(false);
                  setInput("");
                  onConfirm(); // ✅ Ejecuta lo que le pases desde fuera
                }}
              >
                Confirmar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
