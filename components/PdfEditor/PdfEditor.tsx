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
import RangeInput from "../rangeInput/RangeInput";
import { MdArrowBack, MdArrowForward } from "react-icons/md";
import { useRouter } from "next/navigation";

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [scale, setScale] = useState(1.2);
  const [showIcon, setShowIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
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

  useEffect(() => {
    if (pdfDoc?.fingerprints?.[0]) {
      const fp = pdfDoc.fingerprints[0];
      setFingerprint(fp);
      setTextKey(getKey(`textItems_${fp}`));
    }
  }, [pdfDoc, getKey]);

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
    const result = await savePdf(canvasRef, key, loadPDFFromDB, textItems, lineValue);
    if (result.success) {
      showToast("Success", result.message, "success");
    } else {
      showToast("Error", result.message, "error");
    }
  };

  const clearCacheHandler = async () => {
    try {
      await clearPDFCache(key, textKey);
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
        if (!noteUrl) {
          router.push("/study-page");
          return; // ⛔️
        }

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

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = Math.round(
        ((e.clientX - rect.left) * canvas.width) / rect.width
      );
      const canvasY = Math.round(
        ((e.clientY - rect.top) * canvas.height) / rect.height
      );

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const index = textItems.findIndex((item) => {
        if (item.page !== pageNum) return false;

        const metrics = ctx.measureText(item.text);
        const textWidth = metrics.width;
        const textHeight = 20; // можно заменить на item.fontSize, если есть

        const absX = item.relativeX * canvas.width;
        const absY = item.relativeY * canvas.height;

        return (
          canvasX >= absX &&
          canvasX <= absX + textWidth &&
          canvasY >= absY &&
          canvasY <= absY + textHeight
        );
      });

      if (index !== -1) {
        const item = textItems[index];
        if (textRef.current) {
          textRef.current.value = item.text;
          textRef.current.focus();
        }
        setEditingIndex(index);
      } else {
        console.log("Текст не найден для редактирования.");
      }
    },
    [pageNum, textItems]
  );


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("contextmenu", handleContextMenu);

    return () => {
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [handleContextMenu]);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || !pdfDoc) return;

  let draggingItem: TextItem | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  let longPressTimeout: number | null = null;
  let initialX = 0;
  let initialY = 0;
  let moved = false;
  let touchedItem: TextItem | null = null;

  const getCoords = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const mouseDown = (e: MouseEvent) => {
    if (e.button === 2) return;
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
    const { x, y } = getCoords(e.clientX, e.clientY);
    draggingItem.relativeX = (x - dragOffsetX) / canvas.width;
    draggingItem.relativeY = (y - dragOffsetY) / canvas.height;
  };

  const mouseUp = (e: MouseEvent) => {
    if (!draggingItem) return;
    const { x, y } = getCoords(e.clientX, e.clientY);

    const updatedItems = textItems.map((item) =>
      item === draggingItem
        ? {
            ...item,
            relativeX: (x - dragOffsetX) / canvas.width,
            relativeY: (y - dragOffsetY) / canvas.height,
          }
        : item
    );

    localStorage.setItem(textKey, JSON.stringify(updatedItems));
    setTextItems(updatedItems);
    draggingItem = null;

    setTimeout(() => {
      renderPageWithParams(pageNum);
    }, 0);
  };

  const touchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    initialX = touch.clientX;
    initialY = touch.clientY;
    moved = false;
    touchedItem = null;

    const { x, y } = getCoords(initialX, initialY);
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
        touchedItem = item;
        break;
      }
    }

    if (touchedItem) {
      document.body.style.overflow = "hidden"; // 🔒 блокировка scroll
    }

    longPressTimeout = window.setTimeout(() => {
      if (!moved && touchedItem) {
        console.log(`Контекстное меню для: "${touchedItem.text}"`);
        // openContextMenu(touchedItem);
      }
    }, 1000);
  };

  const touchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - initialX);
    const dy = Math.abs(touch.clientY - initialY);

    if (dx > 5 || dy > 5) {
      moved = true;
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
    }
  };

  const touchEnd = (e: TouchEvent) => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }

    document.body.style.overflow = ""; // 🔓 разблокировка scroll

    if (moved && touchedItem) {
      const touch = e.changedTouches[0];
      const { x, y } = getCoords(touch.clientX, touch.clientY);

      touchedItem.relativeX = x / canvas.width;
      touchedItem.relativeY = y / canvas.height;

      const updated = textItems.map((item) =>
        item === touchedItem ? touchedItem : item
      );
      localStorage.setItem(textKey, JSON.stringify(updated));
      setTextItems(updated);
      console.log(`Перемещён элемент: "${touchedItem.text}"`);

      setTimeout(() => {
        renderPageWithParams(pageNum);
      }, 0);
    }

    touchedItem = null;
  };

  const touchCancel = () => {
    document.body.style.overflow = ""; // 🔓 разблокировка scroll
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    touchedItem = null;
  };

  canvas.addEventListener("mousedown", mouseDown);
  canvas.addEventListener("mousemove", mouseMove);
  canvas.addEventListener("mouseup", mouseUp);
  canvas.addEventListener("touchstart", touchStart);
  canvas.addEventListener("touchmove", touchMove, { passive: false });
  canvas.addEventListener("touchend", touchEnd);
  canvas.addEventListener("touchcancel", touchCancel);
  window.addEventListener("mouseup", mouseUp);
  window.addEventListener("touchend", touchEnd);
  window.addEventListener("touchcancel", touchCancel);

  return () => {
    canvas.removeEventListener("mousedown", mouseDown);
    canvas.removeEventListener("mousemove", mouseMove);
    canvas.removeEventListener("mouseup", mouseUp);
    canvas.removeEventListener("touchstart", touchStart);
    canvas.removeEventListener("touchmove", touchMove);
    canvas.removeEventListener("touchend", touchEnd);
    canvas.removeEventListener("touchcancel", touchCancel);
    window.removeEventListener("mouseup", mouseUp);
    window.removeEventListener("touchend", touchEnd);
    window.removeEventListener("touchcancel", touchCancel);
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
          <MdArrowBack />
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
          <MdArrowForward />
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
