import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TextItem } from "../types/types";

const openPDFDatabase = async () => {
  if (typeof window !== "undefined") {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("PDFStorage", 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } else {
    throw new Error("Window is not defined");
  }
};

const savePDFToDB = async (key: string, bytes: Uint8Array): Promise<void> => {
  if (typeof window !== "undefined") {
    const db = await openPDFDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      const store = tx.objectStore("files");
      store.put(bytes, key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } else {
    throw new Error("Window is not defined");
  }
};

const loadPDFFromDB = async (key: string): Promise<Uint8Array | null> => {
  if (typeof window !== "undefined") {
    const db = await openPDFDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result instanceof Blob) {
          result.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        } else if (
          result instanceof Uint8Array ||
          result instanceof ArrayBuffer
        ) {
          resolve(new Uint8Array(result));
        } else resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  } else {
    throw new Error("Window is not defined");
  }
};

export const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number = 300,
  lineHeight: number = 20
) => {
  if (typeof window === "undefined") {
    throw new Error("Window is not defined");
  }

  const words = text.split(" ");
  let line = "";

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line, x, y);
};

export const savePdf = async (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  key: string,
  loadPDFFromDB: (key: string) => Promise<Uint8Array | null>,
  textItems: TextItem[],
  lineValue: number
) => {
  const pdfBytes = await loadPDFFromDB(key);
  if (!pdfBytes || textItems.length === 0)
    return { success: false, message: "Нет данных для сохранения" };

  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);

  const fontBytes = await fetch("/DejaVuSans.ttf").then((r) => r.arrayBuffer());
  const font = await doc.embedFont(fontBytes);
  const pages = doc.getPages();

  for (const item of textItems) {
    const page = pages[item.page - 1];
    const { width, height } = page.getSize();

    const fontSize = (item.fontSize ?? 11) * 0.85;
    const maxWidth = item.lineWidth ?? lineValue;
    const lineHeight = fontSize * 1.3;

    let pdfX = item.relativeX * width;
    let pdfY = height - item.relativeY * height;
    pdfY = adjustYForPDF(pdfY, fontSize);

    const words = item.text.split(" ");
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && i > 0) {
        page.drawText(line.trim(), {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        line = words[i] + " ";
        pdfY -= lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line.trim()) {
      page.drawText(line.trim(), {
        x: pdfX,
        y: pdfY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  const modifiedPdfBytes = await doc.save();
  const blob = new Blob([new Uint8Array(modifiedPdfBytes)], {
    type: "application/pdf",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "konspekt.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);

  return { success: true, message: "Файл сохранен" };
};

export const renderPage = async (
  pageNum: number,
  pdfDoc: any,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  textItems: any[],
  scale: number,
  setPageNum: (n: number) => void,
  wrapTextFn: typeof wrapText,
  isRenderingRef: React.MutableRefObject<boolean>,
  fontValue: number = 16,
  lineValue: number = 300
) => {
  if (isRenderingRef.current || !pdfDoc) return;
  isRenderingRef.current = true;

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) {
    isRenderingRef.current = false;
    return;
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  const lineHeight = fontValue + 4;

  textItems
    .filter((t) => t.page === pageNum)
    .forEach((item) => {
      const absX = item.relativeX * canvas.width;
      const absY = item.relativeY * canvas.height;

      const font = item.fontSize ?? fontValue;
      const line = item.lineWidth ?? lineValue;
      const lineHeight = font + 4;

      ctx.font = `${font}px sans-serif`;
      ctx.fillStyle = "black";
      ctx.textBaseline = "top";

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      wrapTextFn(ctx, item.text, absX, absY, line, lineHeight);
    });

  setPageNum(pageNum);
  isRenderingRef.current = false;
};


export const loadPDF = async (
  fileInput: HTMLInputElement,
  key: string,
  savePDFToDB: (key: string, data: Uint8Array) => Promise<void>,
  setPdfDoc: (doc: any) => void,
  setPageCount: (count: number) => void,
  renderPageFn: (pageNum: number) => void
) => {
  const file = fileInput?.files?.[0];
  if (!file) return alert("Выберите PDF-файл");

  const reader = new FileReader();
  reader.onload = async () => {
    const bytes = new Uint8Array(reader.result as ArrayBuffer);
    await savePDFToDB(key, bytes);

    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    setPdfDoc(doc);
    setPageCount(doc.numPages);
    renderPageFn(1);
  };
  reader.readAsArrayBuffer(file);
};

export const handleCanvasClick = (
  e: React.MouseEvent,
  key: string,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  textRef: React.RefObject<HTMLTextAreaElement>,
  pageNum: number,
  textItems: any[],
  setTextItems: (items: any[]) => void,
  renderPageFn: (updatedItems: any[]) => void,
  fontValue: number,
  lineValue: number
) => {
  const canvas = canvasRef.current!;
  const rect = canvas.getBoundingClientRect();
  const canvasX = ((e.clientX - rect.left) * canvas.width) / rect.width;
  const canvasY = ((e.clientY - rect.top) * canvas.height) / rect.height;

  const relativeX = canvasX / canvas.width;
  const relativeY = canvasY / canvas.height;

  const text = textRef.current?.value.trim();
  if (!text) return;

  const newItem = {
    text,
    page: pageNum,
    relativeX,
    relativeY,
    fontSize: fontValue,
    lineWidth: lineValue,
  };

  const newItems = [...textItems, newItem];
  setTextItems(newItems);
  localStorage.setItem(key, JSON.stringify(newItems));

  renderPageFn(newItems);
};

const adjustYForPDF = (y: number, fontSize: number) => {
  // Смещение вниз на ~baseline + небольшая компенсация
  return y - fontSize * 0.8 + 3;
};



export async function clearPDFCache(key: string, textKey: string) {
  try {
    const db = await openPDFDatabase();
    const tx = db.transaction("files", "readwrite");
    await tx.objectStore("files").delete(key);
    localStorage.removeItem(textKey);
    location.reload();
  } catch (error) {
    console.error("Ошибка при очистке кэша: ", error);
    throw error;
  }
}


export function downloadImage(canvas: HTMLCanvasElement, currentPage: number) {
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `page-${currentPage}.png`;
  link.href = canvas.toDataURL("image/png", 1.0); // 1.0 = максимальное качество
  link.click();
}

export function convertGitHubBlobToRaw(blobUrl: string) {
  const match = blobUrl.match(
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/
  );
  if (!match) return blobUrl;
  const [, user, repo, branch, path] = match;
  return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
}

export default {
  openPDFDatabase,
  savePDFToDB,
  loadPDFFromDB,
  wrapText,
  renderPage,
  loadPDF,
  handleCanvasClick,
  savePdf,
  clearPDFCache,
  downloadImage,
  convertGitHubBlobToRaw,
};
