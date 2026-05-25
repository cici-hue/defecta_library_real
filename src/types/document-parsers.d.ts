/**
 * Type declarations for document parser libraries
 * These are optional dependencies
 */

declare module "mammoth" {
  export function extractRawText(options: { buffer: Buffer }): Promise<{ value: string }>;
}

declare module "xlsx" {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  }
  export function read(data: Buffer, options: { type: "buffer" }): WorkBook;
  export const utils: {
    sheet_to_csv: (sheet: unknown) => string;
  };
}

declare module "pdf-parse" {
  interface PDFParseResult {
    text: string;
    numpages: number;
  }
  function pdfParse(buffer: Buffer): Promise<PDFParseResult>;
  export = pdfParse;
}

declare module "jszip" {
  interface JSZipObject {
    async(type: "text" | "binary" | "base64" | "arraybuffer"): Promise<any>;
  }
  
  interface JSZip {
    loadAsync(data: Buffer | ArrayBuffer | Uint8Array): Promise<JSZip>;
    forEach(callback: (relativePath: string, file: JSZipObject) => void): void;
    file(name: string): JSZipObject | null;
    files: Record<string, JSZipObject>;
  }
  
  const JSZip: {
    new (): JSZip;
    loadAsync(data: Buffer | ArrayBuffer | Uint8Array): Promise<JSZip>;
  };
  
  export default JSZip;
}
