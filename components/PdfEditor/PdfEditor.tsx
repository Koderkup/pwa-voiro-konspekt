"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
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
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const PdfEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [textItems, setTextItems] = useState<any[]>([]);
  const [scale, setScale] = useState(1.2);
  const [showIcon, setShowIcon] = useState(false);
  const { colorMode } = useColorMode();

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

      setTextItems((prev) => {
        const indexToRemove = prev.findIndex((item) => {
          const absX = item.relativeX * canvas.width;
          const absY = item.relativeY * canvas.height;
          return (
            Math.abs(absX - canvasX) < 10 &&
            Math.abs(absY - canvasY) < 10 &&
            item.page === pageNum
          );
        });

        if (indexToRemove !== -1) {
          const updated = [...prev];
          console.log(`Удаляем текст: "${updated[indexToRemove].text}"`);
          updated.splice(indexToRemove, 1);
          localStorage.setItem("textItems", JSON.stringify(updated));
          setTimeout(() => renderPageWithParams(pageNum), 0);
          return updated;
        } else {
          console.log("Текст не найден для удаления.");
          return prev;
        }
      });
    },
    [pageNum]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => {
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [handleContextMenu]);

  const isRendering = useRef(false);
  const initialRenderDone = useRef(false);
  const showToast = useShowToast();
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
  } = pdfUtils;

  const renderPageWithParams = (n: number) =>
    renderPage(
      n,
      pdfDoc,
      canvasRef,
      textItems,
      scale,
      setPageNum,
      wrapText,
      isRendering
    );

  const loadPDFHandler = () => {
    if (!fileRef.current) return;
    loadPDF(
      fileRef.current,
      savePDFToDB,
      setPdfDoc,
      setPageCount,
      renderPageWithParams
    );
  };

  const canvasClickHandler = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasClick(
      e,
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
          isRendering
        )
    );
  };
  const savePdfHandler = async () => {
    const result = await savePdf(canvasRef, loadPDFFromDB, textItems);
    if (result.success) {
      showToast("Success", result.message, "success");
    } else {
      showToast("Error", result.message, "error");
    }
    console.log(result);
  };

  const clearCacheHandler = async () => {
    try {
      await clearPDFCache();
      showToast("Success", "Кэш очищен", "success");
    } catch (error) {
      showToast("Error", "Ошибка при очистке кэша", "error");
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      const pdfBytes = await loadPDFFromDB("pdfRaw");
      if (!pdfBytes) return;

      const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);

      const savedText = localStorage.getItem("textItems");
      if (savedText) {
        const parsed = JSON.parse(savedText);
        setTextItems(parsed);
      }

      const savedPageNum = localStorage.getItem("lastPageNum");
      if (savedPageNum) {
        setPageNum(parseInt(savedPageNum));
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (
      pdfDoc &&
      canvasRef.current &&
      !initialRenderDone.current &&
      textItems.length >= 0
    ) {
      initialRenderDone.current = true;
      renderPageWithParams(pageNum);
    }
  }, [pdfDoc, textItems]);

  useEffect(() => {
    if (pdfDoc && canvasRef.current && initialRenderDone.current) {
      renderPageWithParams(pageNum);
    }
  }, [pageNum, scale]);

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPageWithParams(pageNum);
    }
  }, [textItems]);

  return (
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
                <Drawer.Content bg="rgba(255, 255, 255, 0.8)" maxH="40vh">
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
                      onClick={() => {}}
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
            localStorage.setItem("lastPageNum", String(newPage));
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
            localStorage.setItem("lastPageNum", String(newPage));
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
          min={1}
          max={pageCount}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (value >= 1 && value <= pageCount) {
              setPageNum(value);
            }
          }}
        />
      </NumberInput.Root>
    </Flex>
  );
};

export default PdfEditor;
