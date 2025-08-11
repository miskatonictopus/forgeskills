export async function savePDF(pdfArrayBuffer: ArrayBuffer, fileName: string) {
    const anyWindow = window as any;
    if (anyWindow?.electronAPI?.guardarInformePDF) {
      const uint8 = new Uint8Array(pdfArrayBuffer);
      return anyWindow.electronAPI.guardarInformePDF(uint8, fileName);
    }
  
    // Fallback navegador
    const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
  