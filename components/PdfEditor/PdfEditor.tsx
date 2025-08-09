"use client";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Button,
  Flex,
  Input,
  Badge,
  Textarea,
  NumberInput,
  Kbd,
  CloseButton,
  Drawer,
  Portal,
  Heading,
} from "@chakra-ui/react";
import pdfUtils from "../../utils/pdfUtils";
import useShowToast from "../../hooks/useShowToast";
import { FaRegFile } from "react-icons/fa";
import { useColorMode } from "../ui/color-mode";
import { useUserStorageKey } from "../../hooks/useUserStorageKey";
import useAuthStore from "../../store/authStore";
import Loading from "../Loading/Loading";
import { TextItem } from "../../types/types";
import { useCanvasDrag } from "../../hooks/useCanvasDrag";
import RangeInput from "../rangeInput/RangeInput";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const PdfEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fontValue, setFontValue] = useState(16);
  const [lineValue, setLineValue] = useState(300);
  const { colorMode } = useColorMode();
  const { getKey, uid } = useUserStorageKey();
  const key = getKey("pdfRaw");
  const user = useAuthStore((state) => state.user);
  const [textKey, setTextKey] = useState(getKey("textItems"));
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  useEffect(() => {
    if (pdfDoc?.fingerprints?.[0]) {
      const fp = pdfDoc.fingerprints[0];
      setFingerprint(fp);
      setTextKey(getKey(`textItems_${fp}`));
    }
  }, [pdfDoc, getKey]);

  const [pageCount, setPageCount] = useState(0);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [scale, setScale] = useState(1.2);
  const [showIcon, setShowIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
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
  } = pdfUtils;

  const handleResize = () => {
    if (window.innerWidth < 768) {
      setShowIcon(true);
    } else {
      setShowIcon(false);
    }
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const isRendering = useRef(false);
  const initialRenderDone = useRef(false);
  const showToast = useShowToast();

  const renderPageWithParams = (n: number) =>
    renderPage(
      n,
      pdfDoc,
      canvasRef,
      textItems,
      scale,
      setPageNum,
      wrapText,
      isRendering,
      fontValue,
      lineValue
    );

  const loadPDFHandler = () => {
    if (!fileRef.current) return;
    loadPDF(
      fileRef.current,
      key,
      savePDFToDB,
      setPdfDoc,
      setPageCount,
      renderPageWithParams
    );
  };

  const canvasClickHandler = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasClick(
      e,
      textKey,
      canvasRef,
      textRef,
      pageNum,
      textItems,
      setTextItems,
      (updatedItems) =>
        renderPage(
          pageNum,
          pdfDoc,
          canvasRef,
          updatedItems,
          scale,
          setPageNum,
          wrapText,
          isRendering,
          fontValue,
          lineValue
        ),
      fontValue,
      lineValue
    );
  };
  const savePdfHandler = async () => {
    const result = await savePdf(canvasRef, key, loadPDFFromDB, textItems);
    if (result.success) {
      showToast("Success", result.message, "success");
    } else {
      showToast("Error", result.message, "error");
    }
    console.log(result);
  };

  const clearCacheHandler = async () => {
    try {
      await clearPDFCache(key);
      showToast("Success", "Кэш очищен", "success");
    } catch (error) {
      showToast("Error", "Ошибка при очистке кэша", "error");
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      if (!uid) return;
      setIsLoading(true);
      const pdfBytes = await loadPDFFromDB(key);
      if (pdfBytes) {
        const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        const savedText = localStorage.getItem(textKey);
        if (savedText) {
          setTextItems(JSON.parse(savedText));
        }

        const savedPageNum = localStorage.getItem(
          getKey(`lastPageNum_${fingerprint}`)
        );
        if (savedPageNum) {
          setPageNum(parseInt(savedPageNum));
        }
        setIsLoading(false);
      } else {
        // Если PDF не найден — загружаем по ссылке из accessibleNotes
        const noteUrl = user?.accessibleNotes?.[0]?.url;
        if (!noteUrl) return;

        const rawUrl = convertGitHubBlobToRaw(noteUrl);
        try {
          const response = await fetch(rawUrl);
          if (!response.ok) throw new Error("Ошибка загрузки PDF");

          const pdfData = await response.arrayBuffer();
          await savePDFToDB(key, new Uint8Array(pdfData));

          const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
          setPdfDoc(doc);
          setPageCount(doc.numPages);
          setTextItems([]);
          setPageNum(1);
          renderPageWithParams(1);
          let hasShownToast = false;
          if (!hasShownToast) {
            showToast(
              "Success",
              "PDF загружен из доступной заметки",
              "success"
            );
            hasShownToast = true;
          }
        } catch (err) {
          console.error(err);
          showToast("Error", "Не удалось загрузить PDF по ссылке", "error");
        }
      }
    };

    loadInitialData();
  }, [textKey]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    if (!initialRenderDone.current && textItems.length >= 0) {
      initialRenderDone.current = true;
    }
    renderPageWithParams(pageNum);
  }, [pdfDoc, textItems, pageNum, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfDoc) return;

    let draggingItem: TextItem | null = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const getCoords = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) * canvas.width) / rect.width,
        y: ((clientY - rect.top) * canvas.height) / rect.height,
      };
    };

    const mouseDown = (e: MouseEvent) => {
      const { x, y } = getCoords(e.clientX, e.clientY);
      for (const item of textItems) {
        if (item.page !== pageNum) continue;

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const metrics = ctx.measureText(item.text);
        const w = metrics.width;
        const h = 20;

        const itemX = item.relativeX * canvas.width;
        const itemY = item.relativeY * canvas.height;

        if (x >= itemX && x <= itemX + w && y >= itemY && y <= itemY + h) {
          draggingItem = item;
          dragOffsetX = x - itemX;
          dragOffsetY = y - itemY;
          if (navigator.vibrate) navigator.vibrate(50);
          break;
        }
      }
    };

    const mouseMove = (e: MouseEvent) => {
      if (!draggingItem) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      const isOutside =
        x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

      if (isOutside) {
        const updated = textItems.filter((item) => item !== draggingItem);
        setTextItems(updated);
        localStorage.setItem(textKey, JSON.stringify(updated));
        console.log(`Удалён элемент при выходе: "${draggingItem.text}"`);
        draggingItem = null;
        setTimeout(() => {
          renderPageWithParams(pageNum);
        }, 0);
        return;
      }

      // обычное перемещение
      const canvasX = ((x - rect.left) * canvas.width) / rect.width;
      const canvasY = ((y - rect.top) * canvas.height) / rect.height;

      draggingItem.relativeX = (canvasX - dragOffsetX) / canvas.width;
      draggingItem.relativeY = (canvasY - dragOffsetY) / canvas.height;
    };


    const mouseUp = (e: MouseEvent) => {
      if (!draggingItem) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      const isOutside =
        x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

      let updatedItems = [...textItems];

      if (isOutside) {
        console.log(`Курсор вне canvas: ${isOutside}`);
        updatedItems = updatedItems.filter((item) => item !== draggingItem);
        console.log(`Удалён элемент: "${draggingItem.text}"`);
      } else {
        updatedItems = updatedItems.map((item) =>
          item === draggingItem
            ? {
                ...item,
                relativeX: (x - dragOffsetX - rect.left) / rect.width,
                relativeY: (y - dragOffsetY - rect.top) / rect.height,
              }
            : item
        );
      }

      localStorage.setItem(textKey, JSON.stringify(updatedItems));
      setTextItems(updatedItems);
      setTimeout(() => {
        renderPageWithParams(pageNum);
      }, 0);
      draggingItem = null;
    };

    const touchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const { x, y } = getCoords(touch.clientX, touch.clientY);
      for (const item of textItems) {
        if (item.page !== pageNum) continue;

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const metrics = ctx.measureText(item.text);
        const w = metrics.width;
        const h = 20;

        const itemX = item.relativeX * canvas.width;
        const itemY = item.relativeY * canvas.height;

        if (x >= itemX && x <= itemX + w && y >= itemY && y <= itemY + h) {
          draggingItem = item;
          dragOffsetX = x - itemX;
          dragOffsetY = y - itemY;
          if (navigator.vibrate) navigator.vibrate(50);
          break;
        }
      }
    };


   const touchMove = (e: TouchEvent) => {
     if (!draggingItem) return;
     e.preventDefault();

     const touch = e.touches[0];
     const x = touch.clientX;
     const y = touch.clientY;

     const rect = canvas.getBoundingClientRect();
     const canvasX = ((x - rect.left) * canvas.width) / rect.width;
     const canvasY = ((y - rect.top) * canvas.height) / rect.height;

     draggingItem.relativeX = (canvasX - dragOffsetX) / canvas.width;
     draggingItem.relativeY = (canvasY - dragOffsetY) / canvas.height;

     const itemX = draggingItem.relativeX * canvas.width;
     const itemY = draggingItem.relativeY * canvas.height;

     const fontSize = draggingItem.fontSize ?? 16;
     const ctx = canvas.getContext("2d");
     ctx!.font = `${fontSize}px sans-serif`;
     const metrics = ctx!.measureText(draggingItem.text);
     const textWidth = metrics.width;
     const textHeight = fontSize * 1.2;

     const leftEdge = itemX;
     const rightEdge = itemX + textWidth;
     const topEdge = itemY;
     const bottomEdge = itemY + textHeight;

     const visibleLeft = Math.max(0, leftEdge);
     const visibleRight = Math.min(canvas.width, rightEdge);
     const visibleWidth = visibleRight - visibleLeft;
     const percentVisible = visibleWidth / textWidth;

     const is90PercentOutside = percentVisible < 0.1;

     if (is90PercentOutside) {
       const updated = textItems.filter((item) => item !== draggingItem);
       localStorage.setItem(textKey, JSON.stringify(updated));
       setTextItems(updated);

       const deletedText = draggingItem.text;
       draggingItem = null;

       setTimeout(() => {
         const stored = localStorage.getItem(textKey);
         if (stored) {
           try {
             const parsed = JSON.parse(stored);
             setTextItems(parsed);
           } catch (err) {
             console.error("Ошибка парсинга localStorage:", err);
           }
         }
         renderPageWithParams(pageNum);
       }, 0);

       console.log(`Удалён элемент при выходе >90%: "${deletedText}"`);
       return;
     }
   };


const touchEnd = (e: TouchEvent) => {
  if (!draggingItem) return;

  const touch = e.changedTouches[0];
  const x = touch.clientX;
  const y = touch.clientY;

  const rect = canvas.getBoundingClientRect();
  const isOutside =
    x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

  let updatedItems = [...textItems];

  if (isOutside) {
    updatedItems = updatedItems.filter((item) => item !== draggingItem);
    console.log(`Удалён элемент: "${draggingItem.text}"`);
  } else {
    updatedItems = updatedItems.map((item) =>
      item === draggingItem
        ? {
            ...item,
            relativeX: (x - dragOffsetX - rect.left) / rect.width,
            relativeY: (y - dragOffsetY - rect.top) / rect.height,
          }
        : item
    );
  }

  localStorage.setItem(textKey, JSON.stringify(updatedItems));
  setTextItems(updatedItems);
  draggingItem = null;

  // Синхронизация и рендер
  setTimeout(() => {
    const stored = localStorage.getItem(textKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTextItems(parsed);
      } catch (err) {
        console.error("Ошибка парсинга localStorage:", err);
      }
    }
    renderPageWithParams(pageNum);
  }, 0);
};

    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("touchstart", touchStart);
    canvas.addEventListener("touchmove", touchMove, { passive: false });
    canvas.addEventListener("touchend", touchEnd);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("touchend", touchEnd);
    window.addEventListener("touchcancel", touchEnd);
    return () => {
      canvas.removeEventListener("mousedown", mouseDown);
      canvas.removeEventListener("mousemove", mouseMove);
      canvas.removeEventListener("mouseup", mouseUp);
      canvas.removeEventListener("touchstart", touchStart);
      canvas.removeEventListener("touchmove", touchMove);
      canvas.removeEventListener("touchend", touchEnd);
      window.removeEventListener("mouseup", mouseUp);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);

    };
  }, [canvasRef, textItems, pageNum, renderPageWithParams, textKey]);
  

  return isLoading ? (
    <Loading />
  ) : (
    <Flex direction="column" align="center" width="100%" p={4} gap={4}>
      <Flex justify="space-between" width="100%" wrap="wrap" gap={2}>
        <Input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          width="auto"
        />
        <Button
          variant="subtle"
          colorPalette="blue"
          onClick={loadPDFHandler}
          display={{ base: "none", md: "block" }}
        >
          📂 Показать PDF
        </Button>
        <Button
          variant="subtle"
          colorPalette="red"
          onClick={clearCacheHandler}
          display={{ base: "none", md: "block" }}
        >
          🧹 Очистить кэш
        </Button>
        <Button
          variant="subtle"
          colorPalette="green"
          onClick={savePdfHandler}
          display={{ base: "none", md: "block" }}
        >
          💾 Сохранить PDF
        </Button>
        <Button
          variant="subtle"
          colorPalette="yellow"
          onClick={() => downloadImage(canvasRef.current!, pageNum)}
          display={{ base: "none", md: "block" }}
        >
          📷 скрин страницы
        </Button>
        {showIcon && (
          <Drawer.Root>
            <Drawer.Trigger asChild>
              <Button variant="outline" size="sm">
                <FaRegFile size={24} />
              </Button>
            </Drawer.Trigger>
            <Portal>
              <Drawer.Backdrop />
              <Drawer.Positioner>
                <Drawer.Content bg="rgba(255, 255, 255, 0.8)" maxH="45vh">
                  <Drawer.Header>
                    <Drawer.Title>Файловые кнопки</Drawer.Title>
                  </Drawer.Header>
                  <Drawer.Body
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <Button
                      variant="subtle"
                      colorPalette="blue"
                      onClick={loadPDFHandler}
                      style={{ width: "55%", margin: "6% auto" }}
                    >
                      📂 Показать PDF
                    </Button>
                    <Button
                      variant="subtle"
                      colorPalette="red"
                      onClick={clearCacheHandler}
                      style={{ width: "55%", margin: "6% auto" }}
                    >
                      🧹 Очистить кэш
                    </Button>
                    <Button
                      variant="subtle"
                      colorPalette="green"
                      onClick={savePdfHandler}
                      style={{ width: "55%", margin: "6% auto" }}
                    >
                      💾 Сохранить PDF
                    </Button>
                    <Button
                      variant="subtle"
                      colorPalette="yellow"
                      onClick={() => downloadImage(canvasRef.current!, pageNum)}
                      style={{ width: "55%", margin: "6% auto" }}
                    >
                      📷 скрин страницы
                    </Button>
                  </Drawer.Body>
                  <Drawer.Footer></Drawer.Footer>
                  <Drawer.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Drawer.CloseTrigger>
                </Drawer.Content>
              </Drawer.Positioner>
            </Portal>
          </Drawer.Root>
        )}
      </Flex>
      <Heading>Ваш конспект</Heading>
      <Flex
        flex="1"
        width="100%"
        justify="center"
        align="center"
        overflowX={"auto"}
      >
        <div style={{ overflowX: "auto", width: "100%" }}>
          <canvas
            ref={canvasRef}
            onClick={canvasClickHandler}
            style={{
              display: "block",
              margin: "0 auto",
              width: scale > 1.2 ? `${scale * 100}%` : "100%",
              border: "1px solid #ccc",
              height: "auto",
              cursor: "crosshair",
              filter:
                colorMode === "dark" ? "invert(1) hue-rotate(180deg)" : "none",
            }}
          />
        </div>
      </Flex>
      <Flex justify="center" wrap="wrap" gap={2}>
        <Button
          colorPalette="teal"
          variant="surface"
          onClick={() => {
            const newPage = Math.max(1, pageNum - 1);
            setPageNum(newPage);
            localStorage.setItem(
              getKey(`lastPageNum_${fingerprint}`),
              String(newPage)
            );
          }}
        >
          ⬅
        </Button>
        <Button
          colorPalette="teal"
          variant="surface"
          onClick={() => {
            const newPage = Math.min(pageCount, pageNum + 1);
            setPageNum(newPage);
            localStorage.setItem(
              getKey(`lastPageNum_${fingerprint}`),
              String(newPage)
            );
          }}
        >
          ➡
        </Button>
        <Button
          colorPalette="blue"
          variant="subtle"
          size="md"
          onClick={() => setScale((scale) => Math.min(scale + 0.2, 3))}
        >
          🔍+
        </Button>
        <Button
          colorPalette="blue"
          variant="subtle"
          size="md"
          onClick={() => setScale((scale) => Math.max(scale - 0.2, 1.2))}
        >
          🔎–
        </Button>
      </Flex>

      <Flex direction="column" align="center" gap={2}>
        <Textarea
          ref={textRef}
          rows={3}
          cols={40}
          placeholder="✏️ Введите текст…"
          style={{
            resize: "none",
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
        <Badge colorPalette="purple">
          Страница: {pageNum} / {pageCount}
        </Badge>
      </Flex>
      <Kbd color="blue.500">Перейти к странице:</Kbd>
      <NumberInput.Root defaultValue={pageNum.toString()}>
        <NumberInput.Input
          color="blue.500"
          min={1}
          max={pageCount}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (value >= 1 && value <= pageCount) {
              localStorage.setItem(
                getKey(`lastPageNum_${fingerprint}`),
                String(value)
              );
              setPageNum(value);
            }
          }}
        />
      </NumberInput.Root>
      <RangeInput
        fontValue={fontValue}
        lineValue={lineValue}
        setFontValue={setFontValue}
        setLineValue={setLineValue}
      />
    </Flex>
  );
};

export default PdfEditor;
