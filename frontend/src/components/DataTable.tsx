import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight
} from 'lucide-react';
import { TableRow, ActiveEditor, Collaborator, CellTypingInfo, CellFormat, CellFormatMap } from '../types';
import { getSocket } from '../services/socket';
import { formatCellValue, parseCellCoord, colToIdx } from '../utils/formatters';

interface DataTableProps {
  columns: string[];
  rows: TableRow[];
  totalRows: number;
  page: number;
  limit: number;
  totalPages: number;
  highlightedRows: Record<number, 'local' | 'remote'>;
  activeEditors: Record<number, ActiveEditor>;
  collaborators?: Collaborator[];
  currentCollaborator?: Collaborator | null;
  activeTypingMap?: Record<string, CellTypingInfo>;
  currentSocketId?: string;
  externalEditingRowId?: number | null;
  onCellFocus?: (rowId: number, col: string) => void;
  onCellBlur?: () => void;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  onAddColumn?: (name: string) => Promise<void>;
  onUpdateRow: (
    rowId: number, 
    payload: { cells: Record<string, string>; originalCells?: Record<string, string>; force?: boolean }
  ) => Promise<void>;
  onAddRow: (payload: { cells: Record<string, string> }) => Promise<void>;
  onDeleteRow?: (rowId: number) => Promise<void>;
}

// Convert 1-based index to Excel column letter (1 -> 'A', 26 -> 'Z', 27 -> 'AA', 52 -> 'AZ', 53 -> 'BA'...)
function indexToColLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns: serverColumns,
  rows,
  totalRows,
  page,
  limit: _limit,
  totalPages,
  highlightedRows,
  activeEditors: _activeEditors,
  externalEditingRowId,
  collaborators = [],
  currentCollaborator,
  activeTypingMap = {},
  currentSocketId,
  onCellFocus,
  onCellBlur,
  onPageChange,
  onLimitChange: _onLimitChange,
  onAddColumn: _onAddColumn,
  onUpdateRow,
  onAddRow: _onAddRow,
  onDeleteRow: _onDeleteRow,
}) => {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic visible row count (infinite scroll downwards)
  const [visibleRowCount, setVisibleRowCount] = useState<number>(() => Math.max(50, totalRows + 15));

  // Dynamic visible column count (starts with at least 52 columns: A..Z, AA..AZ like real Excel)
  const [visibleColCount, setVisibleColCount] = useState<number>(() => Math.max(52, serverColumns.length + 10));

  // Active cell state (e.g. A1)
  const [activeCell, setActiveCell] = useState<{ rowId: number; col: string }>({ rowId: 1, col: 'A' });

  // Currently editing cell state
  const [editingCell, setEditingCell] = useState<{ rowId: number; col: string } | null>(null);
  const [cellDraftValue, setCellDraftValue] = useState<string>('');
  const [originalDraftValue, setOriginalDraftValue] = useState<string>('');

  // Cell Formatting State (persisted in localStorage)
  const [cellFormats, setCellFormats] = useState<CellFormatMap>(() => {
    try {
      const saved = localStorage.getItem('syncgrid_cell_formats');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Column Widths & Row Heights State (persisted in localStorage)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('syncgrid_col_widths');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [rowHeights, setRowHeights] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('syncgrid_row_heights');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });


  // Active resize dragging state
  const resizingRef = useRef<{
    type: 'col' | 'row';
    target: string | number;
    startPos: number;
    startSize: number;
  } | null>(null);
  const [activeResizing, setActiveResizing] = useState<{ type: 'col' | 'row'; target: string | number } | null>(null);

  // Mouse handlers for dragging resize handles
  const handleColResizeStart = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest('th');
    const startWidth = colWidths[col] || (th ? th.offsetWidth : 120);
    resizingRef.current = {
      type: 'col',
      target: col,
      startPos: e.clientX,
      startSize: startWidth,
    };
    setActiveResizing({ type: 'col', target: col });
  };

  const handleRowResizeStart = (e: React.MouseEvent, rowId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const tr = (e.currentTarget as HTMLElement).closest('tr');
    const startHeight = rowHeights[rowId] || (tr ? tr.offsetHeight : 34);
    resizingRef.current = {
      type: 'row',
      target: rowId,
      startPos: e.clientY,
      startSize: startHeight,
    };
    setActiveResizing({ type: 'row', target: rowId });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { type, target, startPos, startSize } = resizingRef.current;
      if (type === 'col') {
        const delta = e.clientX - startPos;
        const newWidth = Math.max(50, Math.min(600, startSize + delta));
        setColWidths((prev) => ({ ...prev, [target as string]: newWidth }));
      } else if (type === 'row') {
        const delta = e.clientY - startPos;
        const newHeight = Math.max(24, Math.min(300, startSize + delta));
        setRowHeights((prev) => ({ ...prev, [target as number]: newHeight }));
      }
    };

    const handleMouseUp = () => {
      if (!resizingRef.current) return;
      const { type } = resizingRef.current;
      resizingRef.current = null;
      setActiveResizing(null);
      // Persist final size to localStorage
      if (type === 'col') {
        setColWidths((current) => {
          try {
            localStorage.setItem('syncgrid_col_widths', JSON.stringify(current));
          } catch {}
          return current;
        });
      } else if (type === 'row') {
        setRowHeights((current) => {
          try {
            localStorage.setItem('syncgrid_row_heights', JSON.stringify(current));
          } catch {}
          return current;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Jump-to-cell Name Box Input state
  const [jumpInput, setJumpInput] = useState<string>('');

  // Handle jump to cell submit (e.g. typing "AA10", "BC5", "Z1")
  const handleJumpSubmit = (coordStr: string) => {
    const parsed = parseCellCoord(coordStr);
    if (!parsed) return;
    const { col, rowId } = parsed;
    const colIdx = colToIdx(col);

    // Expand visible columns if destination column is beyond current visible count
    if (colIdx >= visibleColCount) {
      setVisibleColCount(colIdx + 26);
    }
    // Expand visible rows if destination row is beyond current visible count
    if (rowId > visibleRowCount) {
      setVisibleRowCount(rowId + 25);
    }

    setActiveCell({ rowId, col });
    onCellFocus?.(rowId, col);
    setJumpInput('');
  };

  // Sync external editing trigger (from conflict review)
  useEffect(() => {
    if (externalEditingRowId) {
      const col = serverColumns[0] || 'A';
      setActiveCell({ rowId: externalEditingRowId, col });
      setEditingCell({ rowId: externalEditingRowId, col });
      const existing = rows.find(r => r.rowId === externalEditingRowId);
      const val = String(existing?.cells?.[col] ?? '');
      setCellDraftValue(val);
      setOriginalDraftValue(val);
    }
  }, [externalEditingRowId, serverColumns, rows]);

  // Ensure visible rows expands when totalRows or server rows grow
  useEffect(() => {
    if (totalRows + 10 > visibleRowCount) {
      setVisibleRowCount(totalRows + 15);
    }
  }, [totalRows]);

  // Ensure visible columns includes all server columns
  useEffect(() => {
    if (serverColumns.length + 4 > visibleColCount) {
      setVisibleColCount(serverColumns.length + 10);
    }
  }, [serverColumns]);

  // Construct dynamic Excel column list (A..Z..AA..)
  const dynamicColumns = React.useMemo(() => {
    const cols: string[] = [];
    const serverColSet = new Set(serverColumns);

    // First add server-defined columns
    serverColumns.forEach((c) => {
      if (!cols.includes(c)) cols.push(c);
    });

    // Then fill up to visibleColCount with standard A, B, C... AA, AB...
    let i = 1;
    while (cols.length < visibleColCount) {
      const letter = indexToColLetter(i);
      if (!serverColSet.has(letter) && !cols.includes(letter)) {
        cols.push(letter);
      }
      i++;
    }
    return cols;
  }, [serverColumns, visibleColCount]);

  // Build row lookup map by rowId
  const rowMap = React.useMemo(() => {
    const map = new Map<number, TableRow>();
    rows.forEach((r) => {
      map.set(r.rowId, r);
    });
    return map;
  }, [rows]);

  // Track last scroll offsets to decouple vertical scroll from horizontal scroll
  const lastScrollPos = useRef({ top: 0, left: 0 });

  // Handle bidirectional infinite scroll
  const handleScroll = useCallback(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;
    const isScrollingVertically = Math.abs(scrollTop - lastScrollPos.current.top) > 1;
    const isScrollingHorizontally = Math.abs(scrollLeft - lastScrollPos.current.left) > 1;

    lastScrollPos.current = { top: scrollTop, left: scrollLeft };

    if (isScrollingVertically && scrollHeight > clientHeight) {
      if (scrollTop + clientHeight >= scrollHeight - 150) {
        setVisibleRowCount((prev) => prev + 25);
        if (page < totalPages) {
          onPageChange(page + 1);
        }
      }
    }

    if (isScrollingHorizontally && scrollWidth > clientWidth && scrollLeft > 20) {
      if (scrollLeft + clientWidth >= scrollWidth - 120) {
        setVisibleColCount((prev) => prev + 26);
      }
    }
  }, [page, totalPages, onPageChange]);

  // Announce initial cell focus on mount
  useEffect(() => {
    onCellFocus?.(activeCell.rowId, activeCell.col);
  }, []);

  // Reliable socket ID for self-identification
  const myId = currentSocketId || getSocket().id || '';
  const myColor = currentCollaborator?.color || collaborators.find((c) => c.socketId === myId)?.color || '#10b981';

  // Format lookup helpers
  const getCellKey = (col: string, rowId: number) => `${col}${rowId}`;

  const getFormatForCell = (col: string, rowId: number): CellFormat => {
    return cellFormats[getCellKey(col, rowId)] || cellFormats[`col:${col}`] || { type: 'general' };
  };

  const activeFormat = getFormatForCell(activeCell.col, activeCell.rowId);

  const updateActiveCellFormat = (patch: Partial<CellFormat>) => {
    const key = getCellKey(activeCell.col, activeCell.rowId);
    const current = getFormatForCell(activeCell.col, activeCell.rowId);
    const updated = { ...current, ...patch };
    const next = { ...cellFormats, [key]: updated };
    setCellFormats(next);
    try {
      localStorage.setItem('syncgrid_cell_formats', JSON.stringify(next));
    } catch {}
    try {
      getSocket().emit('save_format', { cellRef: key, format: updated });
    } catch {}
  };

  // Sync formats with backend PostgreSQL
  useEffect(() => {
    const socket = getSocket();
    const handleInit = (payload: any) => {
      if (payload.cellFormats) {
        setCellFormats((prev) => ({ ...payload.cellFormats, ...prev }));
      }
    };
    const handleFormatUpdated = ({ cellRef, format }: { cellRef: string; format: CellFormat }) => {
      setCellFormats((prev) => ({ ...prev, [cellRef]: format }));
    };
    socket.on('init_state', handleInit);
    socket.on('format_updated', handleFormatUpdated);
    return () => {
      socket.off('init_state', handleInit);
      socket.off('format_updated', handleFormatUpdated);
    };
  }, []);

  // Cell Click: Focus & update reference box
  const handleCellClick = (rowId: number, col: string) => {
    if (activeCell.rowId === rowId && activeCell.col === col && !editingCell) {
      // Second click on already active cell -> start editing
      handleStartEdit(rowId, col);
      return;
    }
    if (editingCell) {
      handleCommitEdit('none');
    }
    setActiveCell({ rowId, col });
    onCellFocus?.(rowId, col);
  };

  // Start inline cell edit
  const handleStartEdit = (rowId: number, col: string, initialChar?: string) => {
    // Conflict Prevention: If someone else is actively typing here, prevent colliding edits
    const typingKey = `${rowId}:${col}`;
    const remoteTyping = activeTypingMap[typingKey];
    if (remoteTyping && remoteTyping.socketId !== myId) {
      return;
    }

    const existingRow = rowMap.get(rowId);
    const existingVal = String(existingRow?.cells?.[col] ?? '');
    const startVal = initialChar !== undefined ? initialChar : existingVal;

    setActiveCell({ rowId, col });
    setEditingCell({ rowId, col });
    setCellDraftValue(startVal);
    setOriginalDraftValue(existingVal);
    onCellFocus?.(rowId, col);
    getSocket().emit('editing_start', { rowId });
    getSocket().emit('cell_typing', { rowId, col, text: startVal });
  };

  // Live typing text change broadcast
  const handleDraftChange = (newVal: string) => {
    setCellDraftValue(newVal);
    const rId = editingCell?.rowId ?? activeCell.rowId;
    const c = editingCell?.col ?? activeCell.col;
    getSocket().emit('cell_typing', { rowId: rId, col: c, text: newVal });
  };

  // Commit cell edit with direction navigation
  const handleCommitEdit = async (direction: 'down' | 'up' | 'right' | 'left' | 'none' = 'none') => {
    if (!editingCell) return;
    const { rowId, col } = editingCell;
    const existingRow = rowMap.get(rowId);

    getSocket().emit('cell_stop_typing', { rowId, col });
    getSocket().emit('editing_stop', { rowId });
    setEditingCell(null);

    // If value changed, persist to server
    if (cellDraftValue !== originalDraftValue) {
      const currentCells = { ...(existingRow?.cells || {}) };
      const updatedCells = { ...currentCells, [col]: cellDraftValue };

      try {
        await onUpdateRow(rowId, {
          cells: updatedCells,
          originalCells: currentCells,
        });
      } catch (err: any) {
        console.warn('Update failed:', err.message);
      }
    }

    // Directional navigation
    if (direction === 'down') {
      const newRow = rowId + 1;
      setActiveCell({ rowId: newRow, col });
      onCellFocus?.(newRow, col);
    } else if (direction === 'up') {
      const newRow = Math.max(1, rowId - 1);
      setActiveCell({ rowId: newRow, col });
      onCellFocus?.(newRow, col);
    } else if (direction === 'right') {
      const cIdx = dynamicColumns.indexOf(col);
      if (cIdx >= dynamicColumns.length - 2) {
        setVisibleColCount((prev) => prev + 26);
      }
      const newCol = cIdx < dynamicColumns.length - 1 
        ? dynamicColumns[cIdx + 1] 
        : indexToColLetter(cIdx + 2);
      setActiveCell({ rowId, col: newCol });
      onCellFocus?.(rowId, newCol);
    } else if (direction === 'left') {
      const cIdx = dynamicColumns.indexOf(col);
      if (cIdx > 0) {
        const newCol = dynamicColumns[cIdx - 1];
        setActiveCell({ rowId, col: newCol });
        onCellFocus?.(rowId, newCol);
      }
    }
  };

  const handleCancelEdit = () => {
    if (editingCell) {
      getSocket().emit('cell_stop_typing', { rowId: editingCell.rowId, col: editingCell.col });
      getSocket().emit('editing_stop', { rowId: editingCell.rowId });
    }
    setEditingCell(null);
    onCellBlur?.();
  };

  // Clear cell content (Delete / Backspace key on active cell)
  const handleClearCell = async (rowId: number, col: string) => {
    const existingRow = rowMap.get(rowId);
    const currentVal = String(existingRow?.cells?.[col] ?? '');
    if (!currentVal) return;

    const currentCells = { ...(existingRow?.cells || {}) };
    const updatedCells = { ...currentCells, [col]: '' };

    try {
      await onUpdateRow(rowId, {
        cells: updatedCells,
        originalCells: currentCells,
      });
    } catch (err: any) {
      console.warn('Failed to clear cell:', err.message);
    }
  };

  // Excel-Style Global Keyboard Listener with Strict Event Isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Event Isolation: ignore if user is typing into an input/textarea/modal
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.tagName === 'SELECT' ||
         target.isContentEditable ||
         target.closest('.modal-overlay') ||
         target.closest('.simulate-modal') ||
         target.closest('.architecture-modal') ||
         target.closest('.conflict-modal'))
      ) {
        return;
      }

      // If already editing inline, the inline input's keydown handles it
      if (editingCell) {
        return;
      }

      const { rowId, col } = activeCell;
      const colIdx = dynamicColumns.indexOf(col);

      // Arrow Up
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowId > 1) {
          const newRow = rowId - 1;
          setActiveCell({ rowId: newRow, col });
          onCellFocus?.(newRow, col);
        }
        return;
      }

      // Arrow Down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newRow = rowId + 1;
        setActiveCell({ rowId: newRow, col });
        onCellFocus?.(newRow, col);
        return;
      }

      // Arrow Left
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (colIdx > 0) {
          const newCol = dynamicColumns[colIdx - 1];
          setActiveCell({ rowId, col: newCol });
          onCellFocus?.(rowId, newCol);
        }
        return;
      }

      // Arrow Right
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (colIdx >= dynamicColumns.length - 2) {
          setVisibleColCount((prev) => prev + 26);
        }
        const newCol = colIdx < dynamicColumns.length - 1 
          ? dynamicColumns[colIdx + 1] 
          : indexToColLetter(colIdx + 2);
        setActiveCell({ rowId, col: newCol });
        onCellFocus?.(rowId, newCol);
        return;
      }

      // Tab / Shift+Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (colIdx > 0) {
            const newCol = dynamicColumns[colIdx - 1];
            setActiveCell({ rowId, col: newCol });
            onCellFocus?.(rowId, newCol);
          }
        } else {
          if (colIdx >= dynamicColumns.length - 2) {
            setVisibleColCount((prev) => prev + 26);
          }
          const newCol = colIdx < dynamicColumns.length - 1 
            ? dynamicColumns[colIdx + 1] 
            : indexToColLetter(colIdx + 2);
          setActiveCell({ rowId, col: newCol });
          onCellFocus?.(rowId, newCol);
        }
        return;
      }

      // Enter / F2: Enter edit mode
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        handleStartEdit(rowId, col);
        return;
      }

      // Delete / Backspace: Clear cell content
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleClearCell(rowId, col);
        return;
      }

      // Printable character typed: Start editing immediately with typed character!
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        handleStartEdit(rowId, col, e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, editingCell, dynamicColumns, rowMap]);

  // Current active cell coordinates string (e.g. "B4")
  const activeCoordText = `${activeCell.col}${activeCell.rowId}`;

  // Current active cell raw value (for formula bar)
  const activeCellRawValue = (() => {
    if (editingCell && editingCell.rowId === activeCell.rowId && editingCell.col === activeCell.col) {
      return cellDraftValue;
    }
    const r = rowMap.get(activeCell.rowId);
    return String(r?.cells?.[activeCell.col] ?? r?.[activeCell.col] ?? '');
  })();

  return (
    <div id="tour-table" className="spreadsheet-container">
      {/* Unified Excel Toolbar: Left = Cell Reference & Formula Input; Right = Alignment & Style */}
      <div 
        className="excel-toolbar" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '10px', 
          width: '100%',
          flexWrap: 'wrap',
          padding: '6px 12px'
        }}
      >
        {/* Left: Active Cell Reference Box, fx icon, and full formula input bar */}
        <div className="excel-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', minWidth: '200px' }}>
          {/* Active Cell Reference Box (e.g. A1, AA10, BC5 - Editable Name Box to jump to any cell) */}
          <input
            type="text"
            className="cell-name-box"
            title="Name Box: Shows current cell or type cell coordinate (e.g. AA10, BC5) and press Enter to jump"
            style={{
              borderColor: `${myColor}55`,
              color: myColor,
              width: '58px',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              background: 'var(--bg-surface)',
              cursor: 'text',
              flexShrink: 0,
            }}
            value={jumpInput !== '' ? jumpInput : activeCoordText}
            onChange={(e) => setJumpInput(e.target.value.toUpperCase())}
            onFocus={() => setJumpInput(activeCoordText)}
            onBlur={() => setJumpInput('')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleJumpSubmit(jumpInput || activeCoordText);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setJumpInput('');
                (e.target as HTMLInputElement).blur();
              }
            }}
          />

          {/* Formula Function Icon (fx) */}
          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', userSelect: 'none', padding: '0 4px', flexShrink: 0 }}>
            fx
          </span>

          {/* Formula / Cell Content Bar: Takes the entire rest of the left width */}
          <input
            type="text"
            className="form-control"
            style={{ flex: 1, height: '30px', fontSize: '0.84rem', fontFamily: 'var(--font-mono)', minWidth: '160px' }}
            value={activeCellRawValue}
            placeholder="Type cell value to sync..."
            onChange={(e) => {
              if (!editingCell) {
                handleStartEdit(activeCell.rowId, activeCell.col);
              }
              handleDraftChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitEdit('down');
              if (e.key === 'Escape') handleCancelEdit();
            }}
          />
        </div>

        {/* Right: Alignment & Style formatting */}
        <div className="excel-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Alignment */}
          <div className="ribbon-btn-group">
            <button
              type="button"
              className={`ribbon-btn ${activeFormat.align === 'left' ? 'active' : ''}`}
              title="Align Left"
              onClick={() => updateActiveCellFormat({ align: 'left' })}
            >
              <AlignLeft size={13} />
            </button>
            <button
              type="button"
              className={`ribbon-btn ${activeFormat.align === 'center' ? 'active' : ''}`}
              title="Align Center"
              onClick={() => updateActiveCellFormat({ align: 'center' })}
            >
              <AlignCenter size={13} />
            </button>
            <button
              type="button"
              className={`ribbon-btn ${activeFormat.align === 'right' ? 'active' : ''}`}
              title="Align Right"
              onClick={() => updateActiveCellFormat({ align: 'right' })}
            >
              <AlignRight size={13} />
            </button>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-color)', margin: '0 2px' }} />

          {/* Style */}
          <div className="ribbon-btn-group">
            <button
              type="button"
              className={`ribbon-btn ${activeFormat.bold ? 'active' : ''}`}
              title="Bold"
              onClick={() => updateActiveCellFormat({ bold: !activeFormat.bold })}
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              className={`ribbon-btn ${activeFormat.italic ? 'active' : ''}`}
              title="Italic"
              onClick={() => updateActiveCellFormat({ italic: !activeFormat.italic })}
            >
              <Italic size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Infinite Scrollable Excel Grid */}
      <div 
        ref={gridContainerRef}
        className="sheet-grid-wrapper"
        onScroll={handleScroll}
        style={{ maxHeight: 'calc(100vh - 250px)', minHeight: '480px' }}
      >
        <table className="excel-table">
          <thead>
            <tr>
              {/* Sticky Top-Left Corner Box */}
              <th className="corner-cell" style={{ position: 'sticky', top: 0, left: 0, zIndex: 15 }}>
                ◢
              </th>

              {/* Sticky Excel Column Headers (A, B, C, D... Z, AA, AB...) */}
              {dynamicColumns.map((col) => {
                const colWidth = colWidths[col] || 120;
                return (
                  <th 
                    key={col} 
                    className="col-header-cell"
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      width: `${colWidth}px`,
                      minWidth: `${colWidth}px`,
                      maxWidth: `${colWidth}px`,
                      background: activeCell.col === col ? 'var(--bg-surface-secondary)' : undefined,
                    }}
                  >
                    <span>{col}</span>
                    {/* Interactive Column Width Resize Handle */}
                    <div 
                      className={`col-resize-handle ${activeResizing?.type === 'col' && activeResizing?.target === col ? 'is-resizing' : ''}`}
                      onMouseDown={(e) => handleColResizeStart(e, col)}
                      title={`Drag to resize column ${col} width`}
                    />
                  </th>
                );
              })}

              {/* Excel Add Next Column Header Button (+) */}
              <th 
                className="col-header-add-cell"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}
                onClick={() => setVisibleColCount((prev) => prev + 26)}
                title="Add next 26 columns (AA, AB, AC...)"
              >
                +
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: visibleRowCount }).map((_, idx) => {
              const rowId = idx + 1;
              const rowData = rowMap.get(rowId);
              const highlight = highlightedRows[rowId];
              const isRowActive = activeCell.rowId === rowId;

              const rowHeight = rowHeights[rowId] || 34;

              return (
                <tr 
                  key={rowId}
                  style={{
                    height: `${rowHeight}px`,
                    minHeight: `${rowHeight}px`,
                    background: highlight === 'local' 
                      ? 'rgba(16, 185, 129, 0.12)' 
                      : highlight === 'remote' 
                      ? 'rgba(59, 130, 246, 0.12)' 
                      : undefined,
                  }}
                >
                  {/* Sticky Row Index Number Column (1, 2, 3...) */}
                  <td 
                    className="row-header-cell"
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 5,
                      height: `${rowHeight}px`,
                      background: isRowActive ? 'var(--bg-surface-secondary)' : undefined,
                    }}
                  >
                    <span>{rowId}</span>
                    {/* Interactive Row Height Resize Handle */}
                    <div 
                      className={`row-resize-handle ${activeResizing?.type === 'row' && activeResizing?.target === rowId ? 'is-resizing' : ''}`}
                      onMouseDown={(e) => handleRowResizeStart(e, rowId)}
                      title={`Drag to resize row ${rowId} height`}
                    />
                  </td>

                  {/* Excel Dynamic Data Cells */}
                  {dynamicColumns.map((col) => {
                    const colWidth = colWidths[col] || 120;
                    const isCellActive = activeCell.rowId === rowId && activeCell.col === col;
                    const isCellEditing = editingCell?.rowId === rowId && editingCell?.col === col;
                    const rawVal = isCellEditing 
                      ? cellDraftValue 
                      : String(rowData?.cells?.[col] ?? '');

                    const cellFormat = getFormatForCell(col, rowId);
                    const formatted = formatCellValue(rawVal, cellFormat, rowMap);

                    // Collaborator Live Focus (highlight cell border with their color)
                    const focusedCollab = collaborators.find(
                      (c) => c.socketId !== myId && 
                             Number(c.focusedCell?.rowId) === Number(rowId) && 
                             String(c.focusedCell?.col) === String(col)
                    );

                    // Check if another collaborator is actively typing in this cell
                    const typingInfo = activeTypingMap[`${rowId}:${col}`] || (
                      focusedCollab?.typing && 
                      Number(focusedCollab.typing.rowId) === Number(rowId) && 
                      String(focusedCollab.typing.col) === String(col)
                        ? {
                            socketId: focusedCollab.socketId,
                            rowId,
                            col,
                            text: focusedCollab.typing.text,
                            color: focusedCollab.color,
                          }
                        : null
                    );

                    const isRemoteTyping = Boolean(typingInfo && typingInfo.socketId !== myId);

                    // Cell Text Alignment
                    const textAlign = cellFormat.align 
                      ? cellFormat.align 
                      : formatted.isNumeric 
                      ? 'right' 
                      : 'left';

                    return (
                      <td
                        key={col}
                        className={`data-cell cell-align-${textAlign}`}
                        onClick={() => handleCellClick(rowId, col)}
                        onDoubleClick={() => handleStartEdit(rowId, col)}
                        style={{
                          width: `${colWidth}px`,
                          minWidth: `${colWidth}px`,
                          maxWidth: `${colWidth}px`,
                          height: `${rowHeight}px`,
                          outline: focusedCollab 
                            ? `2px solid ${focusedCollab.color}` 
                            : isCellActive 
                            ? `2px solid ${myColor}` 
                            : undefined,
                          outlineOffset: '-2px',
                          background: focusedCollab 
                            ? `${focusedCollab.color}15` 
                            : isCellActive 
                            ? `${myColor}15` 
                            : undefined,
                          cursor: isRemoteTyping ? 'not-allowed' : 'cell',
                          fontWeight: cellFormat.bold ? 700 : undefined,
                          fontStyle: cellFormat.italic ? 'italic' : undefined,
                          textAlign: textAlign,
                        }}
                      >
                        {/* Inline Cell Editor or Formatted Cell Value */}
                        {isCellEditing ? (
                          <input
                            type="text"
                            className="excel-inline-input"
                            value={cellDraftValue}
                            onChange={(e) => handleDraftChange(e.target.value)}
                            onBlur={() => handleCommitEdit('none')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCommitEdit(e.shiftKey ? 'up' : 'down');
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                handleCommitEdit(e.shiftKey ? 'left' : 'right');
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelEdit();
                              }
                            }}
                            style={{
                              borderColor: myColor,
                              boxShadow: `0 0 0 1px ${myColor}44`,
                              textAlign: textAlign,
                            }}
                            autoFocus
                          />
                        ) : (
                          <div 
                            style={{ 
                              minHeight: '20px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: textAlign === 'right' ? 'flex-end' : textAlign === 'center' ? 'center' : 'flex-start',
                              width: '100%' 
                            }}
                          >
                            {isRemoteTyping && typingInfo ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-main)' }}>
                                <span>{typingInfo.text}</span>
                                <span 
                                  className="live-typing-cursor" 
                                  style={{ color: focusedCollab?.color || typingInfo.color || '#3b82f6' }}
                                >
                                  |
                                </span>
                              </span>
                            ) : (
                              <span 
                                title={rawVal}
                              >
                                {formatted.display}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
