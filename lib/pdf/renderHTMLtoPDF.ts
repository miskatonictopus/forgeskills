// lib/pdf/renderHTMLtoPDF.ts
import { BrowserWindow } from "electron";

export async function renderHTMLtoPDF(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });

  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));

    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { marginType: "default" }, // respeta @page de CSS
      landscape: false,
    });

    return pdf;
  } finally {
    win.close();
  }
}
