"use client";

import { useEffect, useState, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

interface DivLine {
  id: string;
  x?: number;
  y?: number;
  color: string;
}

function App() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [currentDiv, setCurrentDiv] = useState<HTMLDivElement | null>(null);
  const [draggedDiv, setDraggedDiv] = useState<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [selectedDiv, setSelectedDiv] = useState<HTMLDivElement | null>(null);
  const [divLines, setDivLines] = useState<Map<HTMLDivElement, DivLine[]>>(
    new Map()
  );
  const [dragStartPos, setDragStartPos] = useState<Position | null>(null);

  const updateDiv = useCallback(
    (div: HTMLDivElement, start: Position, end: Position) => {
      const left = Math.min(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);

      div.style.left = `${left}px`;
      div.style.top = `${top}px`;
      div.style.width = `${width}px`;
      div.style.height = `${height}px`;
    },
    []
  );

  const makeDivDraggable = useCallback((div: HTMLDivElement) => {
    const handleDivMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setDragStartPos({ x: e.clientX, y: e.clientY });

      const rect = div.getBoundingClientRect();
      setDraggedDiv(div);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });

      div.style.opacity = "0.8";
      div.style.cursor = "grabbing";
      div.style.zIndex = "15";
    };

    div.addEventListener("mousedown", handleDivMouseDown);
    div.style.cursor = "grab";

    (div as any).__dragHandler = handleDivMouseDown; // eslint-disable-line @typescript-eslint/no-explicit-any
  }, []);

  const splitDiv = useCallback(
    (div: HTMLDivElement, lines: DivLine[]) => {
      const rect = div.getBoundingClientRect();
      const divLeft = parseInt(div.style.left) || 0;
      const divTop = parseInt(div.style.top) || 0;
      const divWidth = parseInt(div.style.width) || rect.width;
      const divHeight = parseInt(div.style.height) || rect.height;
      const backgroundColor = div.style.backgroundColor;

      const originalTopLeftRadius =
        div.style.borderTopLeftRadius || div.style.borderRadius || "0";
      const originalTopRightRadius =
        div.style.borderTopRightRadius || div.style.borderRadius || "0";
      const originalBottomLeftRadius =
        div.style.borderBottomLeftRadius || div.style.borderRadius || "0";
      const originalBottomRightRadius =
        div.style.borderBottomRightRadius || div.style.borderRadius || "0";

      const horizontalSplits = lines
        .filter((line) => line.y !== undefined)
        .map((line) => line.y!)
        .sort((a, b) => a - b);

      const verticalSplits = lines
        .filter((line) => line.x !== undefined)
        .map((line) => line.x!)
        .sort((a, b) => a - b);

      const allHorizontalSplits = [0, ...horizontalSplits, divHeight]
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);

      const allVerticalSplits = [0, ...verticalSplits, divWidth]
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);

      const newDivs: HTMLDivElement[] = [];

      for (let i = 0; i < allHorizontalSplits.length - 1; i++) {
        for (let j = 0; j < allVerticalSplits.length - 1; j++) {
          const segmentLeft = divLeft + allVerticalSplits[j];
          const segmentTop = divTop + allHorizontalSplits[i];
          const segmentWidth = allVerticalSplits[j + 1] - allVerticalSplits[j];
          const segmentHeight =
            allHorizontalSplits[i + 1] - allHorizontalSplits[i];

          if (segmentWidth > 2 && segmentHeight > 2) {
            const newDiv = document.createElement("div");
            newDiv.className = "absolute";
            newDiv.style.backgroundColor = backgroundColor;
            newDiv.style.position = "absolute";
            newDiv.style.left = `${segmentLeft}px`;
            newDiv.style.top = `${segmentTop}px`;
            newDiv.style.width = `${segmentWidth}px`;
            newDiv.style.height = `${segmentHeight}px`;
            newDiv.style.opacity = "0.7";
            newDiv.style.pointerEvents = "auto";
            newDiv.style.border = "1px solid #000000";
            newDiv.style.userSelect = "none";
            newDiv.style.zIndex = "5";

            const isTopEdge = allHorizontalSplits[i] === 0;
            const isBottomEdge = allHorizontalSplits[i + 1] === divHeight;
            const isLeftEdge = allVerticalSplits[j] === 0;
            const isRightEdge = allVerticalSplits[j + 1] === divWidth;

            newDiv.style.borderTopLeftRadius =
              isTopEdge && isLeftEdge ? originalTopLeftRadius : "0";
            newDiv.style.borderTopRightRadius =
              isTopEdge && isRightEdge ? originalTopRightRadius : "0";
            newDiv.style.borderBottomLeftRadius =
              isBottomEdge && isLeftEdge ? originalBottomLeftRadius : "0";
            newDiv.style.borderBottomRightRadius =
              isBottomEdge && isRightEdge ? originalBottomRightRadius : "0";

            document.body.appendChild(newDiv);
            makeDivDraggable(newDiv);
            newDivs.push(newDiv);
          }
        }
      }

      setDivLines((prevLines) => {
        const newLines = new Map(prevLines);
        newLines.delete(div);
        return newLines;
      });

      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }

      if (selectedDiv === div) {
        setSelectedDiv(null);
      }

      return newDivs;
    },
    [makeDivDraggable, selectedDiv]
  );

  const addLinesToIntersectingDivs = useCallback(
    (crosshairX: number, crosshairY: number) => {
      const allDivs = document.querySelectorAll(
        'div[style*="position: absolute"][style*="background-color"]'
      ) as NodeListOf<HTMLDivElement>;

      const divsToSplit: Array<{ div: HTMLDivElement; lines: DivLine[] }> = [];

      setDivLines((prevLines) => {
        const newLines = new Map(prevLines);

        allDivs.forEach((div) => {
          const rect = div.getBoundingClientRect();
          const divLeft = rect.left;
          const divTop = rect.top;
          const divRight = rect.right;
          const divBottom = rect.bottom;

          const horizontalIntersects =
            crosshairY >= divTop && crosshairY <= divBottom;
          const verticalIntersects =
            crosshairX >= divLeft && crosshairX <= divRight;

          if (horizontalIntersects || verticalIntersects) {
            const existingLines = newLines.get(div) || [];
            const newDivLines = [...existingLines];
            let hasNewLines = false;

            if (horizontalIntersects) {
              const relativeY = crosshairY - divTop;
              const lineId = `h-${crosshairY}`;

              const existingHLine = newDivLines.find(
                (line) => line.id === lineId
              );
              if (!existingHLine) {
                newDivLines.push({
                  id: lineId,
                  y: relativeY,
                  color: "#000000",
                });
                hasNewLines = true;
              }
            }

            if (verticalIntersects) {
              const relativeX = crosshairX - divLeft;
              const lineId = `v-${crosshairX}`;

              const existingVLine = newDivLines.find(
                (line) => line.id === lineId
              );
              if (!existingVLine) {
                newDivLines.push({
                  id: lineId,
                  x: relativeX,
                  color: "#000000",
                });
                hasNewLines = true;
              }
            }

            newLines.set(div, newDivLines);

            if (hasNewLines && newDivLines.length > 0) {
              divsToSplit.push({ div, lines: newDivLines });
            }
          }
        });

        setTimeout(() => {
          divsToSplit.forEach(({ div, lines }) => {
            if (document.body.contains(div)) {
              splitDiv(div, lines);
            }
          });
        }, 0);

        return newLines;
      });
    },
    [splitDiv]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });

      if (draggedDiv) {
        draggedDiv.style.left = `${e.clientX - dragOffset.x}px`;
        draggedDiv.style.top = `${e.clientY - dragOffset.y}px`;
        return;
      }

      if (isDragging && startPos && currentDiv) {
        const endPos: Position = { x: e.clientX, y: e.clientY };
        updateDiv(currentDiv, startPos, endPos);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (draggedDiv) return;
      e.preventDefault();

      const start = { x: e.clientX, y: e.clientY };
      setStartPos(start);
      setIsDragging(true);

      const div = document.createElement("div");
      div.className = "absolute opacity-50";

      const randomColor = `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;

      div.style.backgroundColor = randomColor;
      div.style.position = "absolute";
      div.style.pointerEvents = "none";
      div.style.userSelect = "none";
      div.style.zIndex = "5";
      div.style.border = "1px solid #000000";
      div.style.borderRadius = "12px";

      document.body.appendChild(div);
      setCurrentDiv(div);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();

      if (draggedDiv) {
        draggedDiv.style.opacity = "0.7";
        draggedDiv.style.cursor = "grab";
        draggedDiv.style.zIndex = "5";

        if (dragStartPos) {
          const dragDistance = Math.sqrt(
            Math.pow(e.clientX - dragStartPos.x, 2) +
              Math.pow(e.clientY - dragStartPos.y, 2)
          );

          if (dragDistance < 5) {
            addLinesToIntersectingDivs(e.clientX, e.clientY);

            if (selectedDiv === draggedDiv) {
              setSelectedDiv(null);
            } else {
              setSelectedDiv(draggedDiv);
            }
          }
        }

        setDraggedDiv(null);
        setDragOffset({ x: 0, y: 0 });
        setDragStartPos(null);
        return;
      }

      if (!isDragging || !startPos || !currentDiv) return;

      const width = Math.abs(e.clientX - startPos.x);
      const height = Math.abs(e.clientY - startPos.y);

      if (width < 5 && height < 5) {
        document.body.removeChild(currentDiv);
      } else {
        currentDiv.style.opacity = "0.7";
        currentDiv.style.pointerEvents = "auto";
        makeDivDraggable(currentDiv);
      }

      setIsDragging(false);
      setStartPos(null);
      setCurrentDiv(null);
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (
        selectedDiv &&
        !(e.target as Element).closest(".crosshair-line") &&
        e.target !== selectedDiv &&
        !selectedDiv.contains(e.target as Node)
      ) {
        setSelectedDiv(null);
      }
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mousedown", handleMouseDown, { passive: false });
    document.addEventListener("mouseup", handleMouseUp, { passive: false });
    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [
    isDragging,
    startPos,
    currentDiv,
    updateDiv,
    draggedDiv,
    dragOffset,
    makeDivDraggable,
    selectedDiv,
    dragStartPos,
    addLinesToIntersectingDivs,
  ]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    const allDivs = document.querySelectorAll(
      'div[style*="position: absolute"][style*="background-color"]'
    ) as NodeListOf<HTMLDivElement>;

    allDivs.forEach((div) => {
      {
        div.style.border = "1px solid #000000";
      }
    });
  }, [selectedDiv]);

  useEffect(() => {
    const renderLines = () => {
      document
        .querySelectorAll(".div-intersection-line")
        .forEach((line) => line.remove());

      divLines.forEach((lines, div) => {
        lines.forEach((lineData) => {
          const line = document.createElement("div");
          line.className = "div-intersection-line";
          line.style.position = "absolute";
          line.style.backgroundColor = lineData.color;
          line.style.pointerEvents = "none";
          line.style.zIndex = "10";

          if (lineData.x !== undefined) {
            line.style.left = `${lineData.x}px`;
            line.style.top = "0";
            line.style.width = "2px";
            line.style.height = "100%";
          } else if (lineData.y !== undefined) {
            line.style.left = "0";
            line.style.top = `${lineData.y}px`;
            line.style.width = "100%";
            line.style.height = "2px";
          }

          div.appendChild(line);
        });
      });
    };

    renderLines();
  }, [divLines]);

  return (
    <div
      className="font-mono select-none"
      style={{
        cursor: isDragging
          ? "crosshair"
          : draggedDiv
          ? "grabbing"
          : "crosshair",
      }}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
    >
      <div
        className="absolute top-0 left-0 w-full h-px bg-black z-10 pointer-events-none crosshair-line"
        style={{ transform: `translateY(${position.y}px)` }}
      />

      <div
        className="absolute top-0 left-0 w-px h-full bg-black z-10 pointer-events-none crosshair-line"
        style={{ transform: `translateX(${position.x}px)` }}
      />
      {/* Print some instruction in the left corner how this challenge works */}
      <div className="absolute top-0 left-0 p-4 text-sm">
        <p className="text-black">
          Click and drag the crosshair to create a pill!
        </p>
        <p className="text-black">You can drag the pills using the mouse!</p>
        <p className="text-black">
          Place the crosshair over the pill inorder to slice it!
        </p>
        <p className="text-black">The split sections are draggable!</p>
        <p className="text-black">
          Create more than one pill and slice both pill on a single click!
        </p>
      </div>
    </div>
  );
}

export default App;
