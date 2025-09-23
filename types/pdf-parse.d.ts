// types/pdf-parse.d.ts
declare module "pdf-parse" {
    export interface PDFParseOptions {
      // Función para renderizar cada página a texto (opcional)
      pagerender?: (pageData: any) => string | Promise<string>;
      max?: number;       // páginas máximo (opcional)
      version?: string;   // versión de PDF.js (opcional)
    }
  
    export interface PDFParseResult {
      numpages: number;
      numrender: number;
      info: any;
      metadata: any;
      text: string;
      version: string;
    }
  
    function pdfParse(
      data: Buffer | Uint8Array | ArrayBuffer,
      options?: PDFParseOptions
    ): Promise<PDFParseResult>;
  
    export default pdfParse;
  }
  