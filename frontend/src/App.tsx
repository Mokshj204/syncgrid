import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { CapacityLockScreen } from './components/CapacityLockScreen';
import { DataTable } from './components/DataTable';
import { HistoryPage } from './components/HistoryPage';
import { SimulateSheetModal } from './components/SimulateSheetModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { ConflictModal } from './components/ConflictModal';
import { TourGuide } from './components/TourGuide';
import { OverviewPage } from './components/OverviewPage';
import { LanguageProvider } from './context/LanguageContext';
import { getSocket } from './services/socket';
import { 
  getSheetData, 
  updateRow, 
  addRow, 
  addColumn,
  deleteRow, 
  simulateSheetEdit, 
  forceSync 
} from './services/api';
import { TableRow, ActivityLog, ConnectionStatus, ConflictData, ActiveEditor, Collaborator, CellTypingInfo } from './types';

export const AppContent: React.FC = () => {
  // SPA Routing: '/' vs '/overview' vs '/history'
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const p = window.location.pathname;
    return p === '/overview' || p === '/history' ? p : '/';
  });

  const handleNavigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentRoute(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentRoute(p === '/overview' || p === '/history' ? p : '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [columns, setColumns] = useState<string[]>(['A', 'B', 'C']);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Theme state: dark (neutral gray) or light (offwhite)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('app_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [mode, setMode] = useState<'live' | 'disconnected' | string>('disconnected');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<Record<number, 'local' | 'remote'>>({});
  const [activeEditors, setActiveEditors] = useState<Record<number, ActiveEditor>>({});
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [externalEditingRowId, setExternalEditingRowId] = useState<number | null>(null);

  // 10-Collaborator Presence & Live Cell Tracking State
  const [currentSocketId, setCurrentSocketId] = useState<string>(() => {
    try {
      return getSocket().id || '';
    } catch {
      return '';
    }
  });
  const [currentCollaborator, setCurrentCollaborator] = useState<Collaborator | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activeTypingMap, setActiveTypingMap] = useState<Record<string, CellTypingInfo>>({});
  const [isCapacityReached, setIsCapacityReached] = useState<boolean>(false);
  const [maxCollaborators, setMaxCollaborators] = useState<number>(10);

  // Modals & Guided Tour
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Auto-launch tour guide for first-time visitors
  useEffect(() => {
    const hasSeen = localStorage.getItem('syncgrid_tour_completed');
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsTourOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Helper to trigger temporary highlight on rows
  const triggerHighlight = useCallback((rowId: number, type: 'local' | 'remote') => {
    setHighlightedRows((prev) => ({ ...prev, [rowId]: type }));
    setTimeout(() => {
      setHighlightedRows((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }, 2500);
  }, []);

  // Fetch paginated chunk data
  const loadChunkData = useCallback(async (targetPage: number, targetLimit: number) => {
    try {
      setIsSyncing(true);
      const res = await getSheetData(targetPage, targetLimit);
      if (res.columns && res.columns.length > 0) setColumns(res.columns);
      if (res.rows) setRows(res.rows);
      if (res.totalRows !== undefined) setTotalRows(res.totalRows);
      if (res.totalPages !== undefined) setTotalPages(res.totalPages);
      if (res.mode) setMode(res.mode);
      setLastSyncTime(new Date().toISOString());
    } catch (err: any) {
      console.warn('Failed to load sheet data:', err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [limit]);

  // Setup WebSocket connection and listeners
  useEffect(() => {
    loadChunkData(1, limit);

    const socket = getSocket();

    // Immediately capture socket ID if already connected
    if (socket.connected && socket.id) {
      setCurrentSocketId(socket.id);
      setConnectionStatus('connected');
    }

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setCurrentSocketId(socket.id || '');
      setIsCapacityReached(false);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    // 10-person capacity cap enforcement
    socket.on('capacity_reached', (payload: any) => {
      setIsCapacityReached(true);
      if (payload.maxCollaborators) setMaxCollaborators(payload.maxCollaborators);
    });

    socket.on('init_state', (payload: any) => {
      if (payload.clientId) setCurrentSocketId(payload.clientId);
      if (payload.collaborator) setCurrentCollaborator(payload.collaborator);
      if (payload.collaborators) {
        setCollaborators(payload.collaborators);
        const typing: Record<string, CellTypingInfo> = {};
        payload.collaborators.forEach((c: Collaborator) => {
          if (c.typing && c.socketId !== (payload.clientId || socket.id)) {
            typing[`${c.typing.rowId}:${c.typing.col}`] = {
              socketId: c.socketId,
              rowId: c.typing.rowId,
              col: c.typing.col,
              text: c.typing.text,
              color: c.color,
              nickname: c.nickname,
            };
          }
        });
        setActiveTypingMap(typing);
      }
      if (payload.maxCollaborators) setMaxCollaborators(payload.maxCollaborators);
      if (payload.columns) setColumns(payload.columns);
      if (payload.data) setRows(payload.data);
      if (payload.totalRows !== undefined) setTotalRows(payload.totalRows);
      if (payload.totalPages !== undefined) setTotalPages(payload.totalPages);
      if (payload.mode) setMode(payload.mode);
      if (payload.activityLog) setActivityLogs(payload.activityLog);
      if (payload.activeEditors) setActiveEditors(payload.activeEditors);
      setConnectionStatus('connected');
      setIsCapacityReached(false);
    });

    // Real-time collaborator roster update
    socket.on('collaborators_changed', (collabs: Collaborator[]) => {
      setCollaborators(collabs);
      const myId = socket.id;
      if (myId) setCurrentSocketId(myId);
      const me = collabs.find((c) => c.socketId === myId);
      if (me) {
        setCurrentCollaborator(me);
      }
      const typing: Record<string, CellTypingInfo> = {};
      collabs.forEach((c) => {
        if (c.typing && c.socketId !== myId) {
          typing[`${c.typing.rowId}:${c.typing.col}`] = {
            socketId: c.socketId,
            rowId: c.typing.rowId,
            col: c.typing.col,
            text: c.typing.text,
            color: c.color,
            nickname: c.nickname,
          };
        }
      });
      setActiveTypingMap(typing);
    });

    // Real-time live cell typing sync
    socket.on('cell_typing', (payload: CellTypingInfo) => {
      if (payload.socketId !== socket.id) {
        setActiveTypingMap((prev) => ({
          ...prev,
          [`${payload.rowId}:${payload.col}`]: payload,
        }));
      }
    });

    socket.on('cell_stop_typing', ({ rowId, col }: { rowId: number; col: string }) => {
      setActiveTypingMap((prev) => {
        const next = { ...prev };
        delete next[`${rowId}:${col}`];
        return next;
      });
    });

    socket.on('row_editing_status', (editors: Record<number, ActiveEditor>) => {
      setActiveEditors(editors || {});
    });

    // Real-time columns update event
    socket.on('columns_updated', (payload: any) => {
      if (payload.columns) setColumns(payload.columns);
      if (payload.activity) {
        setActivityLogs((prev) => [payload.activity, ...prev].slice(0, 50));
      }
    });

    // Handle incoming Sheet updates (from Google Sheets Poller or Webhook)
    socket.on('sheet_updated', (payload: any) => {
      if (payload.columns && payload.columns.length > 0) {
        setColumns(payload.columns);
      }
      if (payload.totalRows !== undefined) {
        setTotalRows(payload.totalRows);
      }
      if (payload.mode) {
        setMode(payload.mode);
      }
      if (payload.timestamp) {
        setLastSyncTime(payload.timestamp);
      }
      if (payload.activity) {
        setActivityLogs((prev) => [payload.activity, ...prev].slice(0, 50));
      }

      // If update was originated from our web edits, we already have it locally
      if (payload.source === 'web_edit' || payload.source === 'web_add') {
        return;
      }

      if (payload.rows && Array.isArray(payload.rows) && payload.rows.length > 0) {
        // Clean sync: update rows from Google Sheets without resurrecting deleted columns
        setRows((prev) => {
          const rowMap = new Map(prev.map((r) => [r.rowId, r]));
          for (const remoteRow of payload.rows) {
            const rawCells = remoteRow.cells || remoteRow;
            const cleanCells: Record<string, string> = {};
            if (rawCells && typeof rawCells === 'object') {
              for (const [k, v] of Object.entries(rawCells)) {
                if (k !== 'rowId' && k !== 'cells' && k !== 'version' && k !== 'updated_at') {
                  cleanCells[k] = v !== null && v !== undefined ? String(v) : '';
                }
              }
            }

            const cleanRow: TableRow = {
              rowId: remoteRow.rowId,
              cells: cleanCells,
              version: remoteRow.version || 'v1',
              ...cleanCells,
            };
            rowMap.set(remoteRow.rowId, cleanRow);
          }
          return Array.from(rowMap.values()).sort((a, b) => a.rowId - b.rowId);
        });
      }

      if (payload.activity?.data?.rowId) {
        triggerHighlight(payload.activity.data.rowId, 'remote');
      }
    });

    // Handle single row updated
    socket.on('row_updated', (payload: any) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.rowId === payload.rowId) {
            const updatedCells = payload.row?.cells || payload.cells || {};
            return {
              ...r,
              ...updatedCells,
              cells: updatedCells,
              version: payload.row?.version || r.version,
            };
          }
          return r;
        })
      );

      if (payload.activity) {
        setActivityLogs((prev) => [payload.activity, ...prev].slice(0, 50));
      }
      triggerHighlight(payload.rowId, payload.source === 'web' ? 'local' : 'remote');
      setLastSyncTime(new Date().toISOString());
    });

    // Handle row added
    socket.on('row_added', (payload: any) => {
      setTotalRows((prev) => prev + 1);
      setRows((prev) => {
        if (prev.some((r) => r.rowId === payload.row.rowId)) return prev;
        return [...prev, payload.row];
      });
      if (payload.activity) {
        setActivityLogs((prev) => [payload.activity, ...prev].slice(0, 50));
      }
      triggerHighlight(payload.row.rowId, 'local');
      setLastSyncTime(new Date().toISOString());
    });

    // Handle row deleted
    socket.on('row_deleted', (payload: any) => {
      setTotalRows((prev) => Math.max(0, prev - 1));
      setRows((prev) => prev.filter((r) => r.rowId !== payload.rowId));
      if (payload.activity) {
        setActivityLogs((prev) => [payload.activity, ...prev].slice(0, 50));
      }
      setLastSyncTime(new Date().toISOString());
    });

    // Handle runtime sheets reconfiguration from /overview
    socket.on('sheets_config_updated', (payload: any) => {
      if (payload.activity) {
        setActivityLogs((prev) => [payload.activity, ...prev].slice(0, 50));
      }
      if (payload.pythonResult?.columns) {
        setColumns(payload.pythonResult.columns);
      }
      if (payload.pythonResult?.mode) {
        setMode(payload.pythonResult.mode);
      }
      loadChunkData(page, limit);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('init_state');
      socket.off('row_editing_status');
      socket.off('columns_updated');
      socket.off('sheet_updated');
      socket.off('row_updated');
      socket.off('row_added');
      socket.off('row_deleted');
      socket.off('sheets_config_updated');
    };
  }, [loadChunkData, page, limit, triggerHighlight]);

  // Page and Chunk controls
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      loadChunkData(newPage, limit);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    loadChunkData(1, newLimit);
  };

  // Add Column
  const handleAddColumn = async (name: string) => {
    const res = await addColumn(name);
    if (res.columns) {
      setColumns(res.columns);
    }
  };

  // Handle Edit & Submit from website with optimistic concurrency checking
  const handleUpdateRow = async (
    rowId: number,
    payload: {
      cells: Record<string, string>;
      originalCells?: Record<string, string>;
      force?: boolean;
    }
  ) => {
    // 1. Optimistic UI update: apply change immediately so user sees zero delay/disappearance
    setRows((prev) => {
      const exists = prev.some((r) => r.rowId === rowId);
      if (exists) {
        return prev.map((r) => {
          if (r.rowId === rowId) {
            const mergedCells = { ...(r.cells || {}), ...payload.cells };
            return {
              ...r,
              ...mergedCells,
              cells: mergedCells,
            };
          }
          return r;
        });
      } else {
        const newRow: TableRow = {
          rowId,
          cells: payload.cells,
          version: 'optimistic',
          ...payload.cells,
        };
        return [...prev, newRow];
      }
    });

    try {
      const res = await updateRow(rowId, payload);
      if (res.row) {
        setRows((prev) =>
          prev.map((r) => (r.rowId === rowId ? res.row : r))
        );
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictData(err.response.data);
      } else {
        // Revert optimistic update if non-conflict failure occurs
        const orig = payload.originalCells;
        if (orig) {
          setRows((prev) =>
            prev.map((r) =>
              r.rowId === rowId
                ? { ...r, ...orig, cells: orig }
                : r
            )
          );
        }
        alert(`Update failed: ${err.response?.data?.detail || err.response?.data?.error || err.message}`);
      }
      throw err;
    }
  };

  // Conflict Resolution: Force Overwrite (Keep Mine)
  const handleForceOverwrite = async (
    rowId: number,
    attemptedValues: Record<string, string>
  ) => {
    try {
      await handleUpdateRow(rowId, { cells: attemptedValues, force: true });
      setConflictData(null);
    } catch (err: any) {
      alert(`Force overwrite failed: ${err.message}`);
    }
  };

  // Conflict Resolution: Accept Remote (Keep Google Sheets)
  const handleAcceptRemote = (rowId: number) => {
    if (conflictData?.currentServerRow) {
      setRows((prev) =>
        prev.map((r) => (r.rowId === rowId ? conflictData.currentServerRow : r))
      );
    }
    setConflictData(null);
  };

  // Conflict Resolution: Re-Edit / Review & Merge
  const handleReEdit = (rowId: number, currentServerRow: Record<string, string>) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, ...currentServerRow, cells: currentServerRow } : r))
    );
    setConflictData(null);
    setExternalEditingRowId(rowId);
  };

  // Handle Add Row from website
  const handleAddRow = async (payload: { cells: Record<string, string> }) => {
    const res = await addRow(payload);
    if (res.row) {
      setTotalRows((prev) => prev + 1);
      setRows((prev) => {
        if (prev.some((r) => r.rowId === res.row.rowId)) return prev;
        return [...prev, res.row];
      });
      triggerHighlight(res.row.rowId, 'local');
    }
  };

  // Handle Delete Row from website
  const handleDeleteRow = async (rowId: number) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    setTotalRows((prev) => Math.max(0, prev - 1));
    await deleteRow(rowId);
  };

  // Handle Simulate direct Google Sheet edit
  const handleSimulateEdit = async (payload: {
    rowId: number;
    cells?: Record<string, string>;
  }) => {
    await simulateSheetEdit(payload);
  };

  // Handle Force Manual Sync
  const handleForceSync = async () => {
    try {
      setIsSyncing(true);
      const res = await forceSync();
      if (res.columns) setColumns(res.columns);
      loadChunkData(page, limit);
      setLastSyncTime(new Date().toISOString());
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle nickname update from CollaboratorBar
  const handleUpdateNickname = (nickname: string) => {
    getSocket().emit('update_profile', { nickname });
  };

  // Live Cell Focus: Notify server when collaborator focuses or blurs a cell
  const handleCellFocus = (rowId: number, col: string) => {
    getSocket().emit('cell_focus', { rowId, col });
  };

  const handleCellBlur = () => {
    getSocket().emit('cell_blur');
  };

  // Retry connection when 10-collaborator capacity was reached
  const handleRetryConnection = () => {
    const socket = getSocket();
    setIsCapacityReached(false);
    if (!socket.connected) {
      socket.connect();
    }
  };

  return (
    <div className="app-container">
      {/* 10-Collaborator Capacity Lock Screen (if active session cap reached) */}
      {isCapacityReached && (
        <CapacityLockScreen
          maxCollaborators={maxCollaborators}
          collaborators={collaborators}
          onRetry={handleRetryConnection}
        />
      )}

      {/* Compact Single Top Navbar */}
      <Navbar
        status={connectionStatus}
        mode={mode}
        isSyncing={isSyncing}
        theme={theme}
        onToggleTheme={toggleTheme}
        onForceSync={handleForceSync}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        currentCollaborator={currentCollaborator}
        collaborators={collaborators}
        onUpdateNickname={handleUpdateNickname}
        lastSyncTime={lastSyncTime}
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
      />

      {/* Main View: /overview vs /history vs / (Spreadsheet Grid) */}
      {currentRoute === '/overview' ? (
        <OverviewPage onNavigateHome={() => handleNavigate('/')} />
      ) : currentRoute === '/history' ? (
        <HistoryPage 
          logs={activityLogs} 
          onNavigateHome={() => handleNavigate('/')} 
          onClearLogs={() => setActivityLogs([])}
          onForceSync={handleForceSync}
          isSyncing={isSyncing}
        />
      ) : (
        <>
          {/* Dynamic Multi-Column Grid with Chunked Pagination and Live Cell Cursors */}
          <DataTable
            columns={columns}
            rows={rows}
            totalRows={totalRows}
            page={page}
            limit={limit}
            totalPages={totalPages}
            highlightedRows={highlightedRows}
            activeEditors={activeEditors}
            externalEditingRowId={externalEditingRowId}
            currentCollaborator={currentCollaborator}
            collaborators={collaborators}
            activeTypingMap={activeTypingMap}
            currentSocketId={currentSocketId}
            onCellFocus={handleCellFocus}
            onCellBlur={handleCellBlur}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            onAddColumn={handleAddColumn}
            onUpdateRow={handleUpdateRow}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />
        </>
      )}

      {/* Interactive Conflict Resolution Modal */}
      <ConflictModal
        conflict={conflictData}
        columns={columns}
        onClose={() => setConflictData(null)}
        onForceOverwrite={handleForceOverwrite}
        onAcceptRemote={handleAcceptRemote}
        onReEdit={handleReEdit}
      />

      {/* Simulation Modal for testing direct Google Sheet changes */}
      <SimulateSheetModal
        isOpen={isSimulateOpen}
        onClose={() => setIsSimulateOpen(false)}
        columns={columns}
        rows={rows}
        onSimulate={handleSimulateEdit}
      />

      {/* Architecture & Documentation Modal */}
      <ArchitectureModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />

      {/* Interactive Spotlight Tour Guide */}
      <TourGuide
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
