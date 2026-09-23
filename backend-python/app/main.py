import logging
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.sheets_service import sheets_service, RowConflictException
from app.poller import poller

logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sheets Sync Engine...")
    
    # Auto-load persisted Google Sheets configuration from Node.js / PostgreSQL
    try:
        import httpx
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{settings.NODE_INTERNAL_URL.replace('/internal/sync-event', '')}/api/sheets-config")
            if resp.status_code == 200:
                data = resp.json()
                cfg = data.get("config", {})
                sp_id = (cfg.get("spreadsheetId") or "").strip()
                sh_name = (cfg.get("sheetName") or "Sheet1").strip()
                if sp_id:
                    logger.info(f"Auto-connecting to persisted Google Sheet ID '{sp_id}' (Tab: '{sh_name}')...")
                    res = sheets_service.reconfigure(sp_id, sh_name)
                    logger.info(f"Startup reconfiguration result: {res.get('message') or res.get('error')}")
    except Exception as e:
        logger.warning(f"Could not auto-fetch persisted sheet config from Node on startup: {e}")

    await poller.start()
    yield
    logger.info("Stopping Sheets Sync Engine...")
    await poller.stop()

app = FastAPI(
    title="Google Sheets ↔ Web Real-Time Sync Engine",
    version="2.0.0",
    description="Python backend managing dynamic multi-column Google Sheets sync, chunked pagination, and change detection.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DynamicRowPayload(BaseModel):
    cells: Optional[Dict[str, Any]] = None
    A: Optional[str] = None
    B: Optional[str] = None
    C: Optional[str] = None
    originalCells: Optional[Dict[str, Any]] = None
    originalA: Optional[str] = None
    originalB: Optional[str] = None
    originalC: Optional[str] = None
    force: Optional[bool] = False

    def get_cells_dict(self) -> Dict[str, str]:
        if self.cells is not None:
            return {str(k): str(v) for k, v in self.cells.items()}
        res = {}
        if self.A is not None: res["A"] = self.A
        if self.B is not None: res["B"] = self.B
        if self.C is not None: res["C"] = self.C
        return res

    def get_original_cells_dict(self) -> Optional[Dict[str, str]]:
        if self.originalCells is not None:
            return {str(k): str(v) for k, v in self.originalCells.items()}
        if self.originalA is not None or self.originalB is not None or self.originalC is not None:
            res = {}
            if self.originalA is not None: res["A"] = self.originalA
            if self.originalB is not None: res["B"] = self.originalB
            if self.originalC is not None: res["C"] = self.originalC
            return res
        return None

class ColumnPayload(BaseModel):
    name: str = Field(..., description="Name of the new column header")

class SimulateEditPayload(BaseModel):
    rowId: int = Field(..., description="ID of row to simulate direct edit on")
    cells: Optional[Dict[str, Any]] = None
    A: Optional[str] = None
    B: Optional[str] = None
    C: Optional[str] = None

class ReconfigurePayload(BaseModel):
    spreadsheetId: Optional[str] = ""
    sheetName: Optional[str] = "Sheet1"

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "sheets-sync-engine-python",
        "mode": sheets_service.mode,
        "spreadsheet_id": sheets_service.spreadsheet_id,
        "sheet_name": sheets_service.sheet_name,
        "spreadsheet_id_configured": bool(sheets_service.spreadsheet_id),
        "poller_running": poller.is_running,
        "columns": sheets_service.get_columns()
    }

@app.post("/api/sheets/reconfigure")
async def reconfigure_sheets(payload: ReconfigurePayload):
    """
    Dynamically connect or switch the Google Sheet at runtime.
    Persisted configuration from Node/PostgreSQL is applied here without service restarts.
    """
    result = sheets_service.reconfigure(
        spreadsheet_id=payload.spreadsheetId or "",
        sheet_name=payload.sheetName or "Sheet1"
    )
    return result

@app.post("/api/sheets/test-connection")
async def test_sheets_connection(payload: ReconfigurePayload):
    """
    Tests whether the given spreadsheet ID and sheet title are accessible with current credentials.
    """
    result = sheets_service.test_connection(
        spreadsheet_id=payload.spreadsheetId or "",
        sheet_name=payload.sheetName or "Sheet1"
    )
    return result

@app.get("/api/sheets/data")
async def get_sheet_data(
    page: int = Query(1, ge=1, description="Page number for chunked loading"),
    limit: int = Query(25, ge=1, le=200, description="Chunk size per page")
):
    """
    Returns table data in chunks / pagination with dynamic columns.
    Prevents transferring the entire sheet all at once.
    """
    try:
        chunk_data = sheets_service.get_chunked_rows(page=page, limit=limit)
        return {
            "status": "success",
            "mode": sheets_service.mode,
            "columns": chunk_data["columns"],
            "rows": chunk_data["rows"],
            "totalRows": chunk_data["totalRows"],
            "page": chunk_data["page"],
            "limit": chunk_data["limit"],
            "totalPages": chunk_data["totalPages"],
            "hash": chunk_data["hash"],
            "lastSyncTime": poller.last_sync_time
        }
    except Exception as e:
        logger.error(f"Error fetching sheet data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sheet data: {str(e)}"
        )

@app.get("/api/sheets/columns")
async def get_columns():
    """Returns all current column headers."""
    return {
        "status": "success",
        "columns": sheets_service.get_columns()
    }

@app.post("/api/sheets/columns")
async def add_column(payload: ColumnPayload):
    """Adds a new column to the Google Sheet and store."""
    try:
        cols = sheets_service.add_column(payload.name)
        poller.update_hash()
        return {
            "status": "success",
            "columns": cols
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/sheets/rows/{row_id}")
async def update_row(row_id: int, payload: DynamicRowPayload):
    """Updates row across dynamic columns with optimistic concurrency check."""
    try:
        cells = payload.get_cells_dict()
        original_cells = payload.get_original_cells_dict()

        updated_row = sheets_service.update_row(
            row_id=row_id,
            cells=cells,
            original_cells=original_cells,
            force=payload.force or False
        )
        # Mark row as freshly written so poller doesn't overwrite it with stale data
        poller.mark_row_written(row_id)
        poller.update_hash()
        return {
            "status": "success",
            "message": f"Row {row_id} updated successfully",
            "row": updated_row
        }
    except RowConflictException as ce:
        logger.warning(f"409 Conflict on row {row_id}")
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "status": "conflict",
                "message": "This row was updated in Google Sheets or by another collaborator since you loaded it.",
                "currentServerRow": ce.current_row,
                "attemptedValues": ce.attempted_values,
                "rowId": row_id
            }
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating row {row_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update row {row_id}: {str(e)}"
        )

class AddRowPayload(BaseModel):
    cells: Optional[Dict[str, Any]] = None
    rowId: Optional[int] = None
    A: Optional[str] = None
    B: Optional[str] = None
    C: Optional[str] = None

    def get_cells_dict(self) -> Dict[str, str]:
        if self.cells is not None:
            return {str(k): str(v) for k, v in self.cells.items()}
        res = {}
        if self.A is not None: res["A"] = self.A
        if self.B is not None: res["B"] = self.B
        if self.C is not None: res["C"] = self.C
        return res

@app.post("/api/sheets/rows")
async def add_row(payload: AddRowPayload):
    """Adds a row to the table, optionally at a specific position."""
    try:
        cells = payload.get_cells_dict()
        new_row = sheets_service.add_row(cells, row_id=payload.rowId)
        # Mark row as freshly written so poller doesn't overwrite it
        poller.mark_row_written(new_row["rowId"])
        poller.update_hash()
        return {
            "status": "success",
            "message": "Row added successfully",
            "row": new_row
        }
    except Exception as e:
        logger.error(f"Error adding row: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add row: {str(e)}"
        )

@app.delete("/api/sheets/rows/{row_id}")
async def delete_row(row_id: int):
    """Deletes a row by rowId."""
    try:
        success = sheets_service.delete_row(row_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Row {row_id} not found")
        poller.update_hash()
        return {
            "status": "success",
            "message": f"Row {row_id} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting row {row_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete row {row_id}: {str(e)}"
        )

@app.post("/api/sheets/simulate-sheet-edit")
async def simulate_sheet_edit(payload: SimulateEditPayload):
    """Simulates an external direct modification across dynamic columns."""
    all_rows = sheets_service.get_all_rows()
    target = next((r for r in all_rows if r["rowId"] == payload.rowId), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Row {payload.rowId} not found")

    new_cells = dict(target.get("cells", {}))
    if payload.cells:
        for k, v in payload.cells.items():
            new_cells[str(k)] = str(v)
    else:
        if payload.A is not None: new_cells["A"] = payload.A
        if payload.B is not None: new_cells["B"] = payload.B
        if payload.C is not None: new_cells["C"] = payload.C

    updated = sheets_service.update_row(payload.rowId, cells=new_cells, force=True)
    await poller.check_for_updates(source_override="google_sheets_direct_edit")
    return {
        "status": "success",
        "message": f"Simulated direct edit on Google Sheet row {payload.rowId}",
        "row": updated
    }

@app.post("/api/sheets/force-sync")
async def force_sync():
    """Forces an immediate synchronization check."""
    changed = await poller.check_for_updates(source_override="manual_trigger", force=True)
    return {
        "status": "success",
        "changed": changed,
        "columns": sheets_service.get_columns(),
        "rows": sheets_service.get_all_rows()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
