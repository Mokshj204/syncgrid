import os
import json
import logging
import hashlib
from typing import List, Dict, Any, Optional
import gspread
from google.oauth2.service_account import Credentials

from app.config import settings

logger = logging.getLogger("sheets_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

def col_index_to_letter(col_idx: int) -> str:
    """Converts 1-based column index to spreadsheet letter (1 -> 'A', 26 -> 'Z', 27 -> 'AA')."""
    result = ""
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result

def letter_to_col_index(letter: str) -> int:
    """Converts spreadsheet letter to 1-based column index ('A' -> 1, 'Z' -> 26, 'AA' -> 27)."""
    result = 0
    for char in letter.strip().upper():
        if 'A' <= char <= 'Z':
            result = result * 26 + (ord(char) - ord('A') + 1)
    return result

class RowConflictException(Exception):
    def __init__(self, current_row: Dict[str, Any], attempted_values: Dict[str, Any]):
        self.current_row = current_row
        self.attempted_values = attempted_values
        super().__init__("Conflict detected: This row was modified by another user or directly in Google Sheets.")

class GoogleSheetsService:
    def __init__(self):
        self.mode = "disconnected"  # "live" or "disconnected"
        self.client: Optional[gspread.Client] = None
        self.sheet: Optional[gspread.Worksheet] = None
        self.spreadsheet_id: str = settings.SPREADSHEET_ID
        self.sheet_name: str = settings.SHEET_NAME
        self._columns: List[str] = ["A", "B", "C"]
        
        self._init_client()

    def _get_credentials(self) -> Optional[Credentials]:
        """Loads credentials from environment variable JSON or file."""
        creds = None
        if settings.SERVICE_ACCOUNT_JSON_RAW:
            try:
                info = json.loads(settings.SERVICE_ACCOUNT_JSON_RAW)
                creds = Credentials.from_service_account_info(info, scopes=SCOPES)
                logger.info("Loaded service account credentials from GOOGLE_SERVICE_ACCOUNT_JSON environment variable.")
                return creds
            except Exception as e:
                logger.warning(f"Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: {e}")

        candidate_paths = [
            settings.CREDENTIALS_FILE,
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), settings.CREDENTIALS_FILE),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), settings.CREDENTIALS_FILE),
        ]

        for p in candidate_paths:
            if p and os.path.exists(p):
                try:
                    creds = Credentials.from_service_account_file(p, scopes=SCOPES)
                    logger.info(f"Loaded service account credentials from {p}")
                    return creds
                except Exception as e:
                    logger.warning(f"Failed to load credentials file {p}: {e}")
        return creds

    def _init_client(self):
        """Initializes Google Sheets client if valid credentials and SPREADSHEET_ID exist."""
        try:
            creds = self._get_credentials()

            if creds and self.spreadsheet_id:
                self.client = gspread.authorize(creds)
                doc = self.client.open_by_key(self.spreadsheet_id)
                try:
                    self.sheet = doc.worksheet(self.sheet_name)
                except gspread.WorksheetNotFound:
                    self.sheet = doc.sheet1
                
                self._load_or_init_sheet()
                self.mode = "live"
                logger.info(f"Connected to Google Sheet '{self.spreadsheet_id}', tab '{self.sheet.title}'. Live Mode ACTIVE.")
            else:
                self.mode = "disconnected"
                reason = "SPREADSHEET_ID not provided" if not self.spreadsheet_id else "Credentials not found"
                logger.info(f"Google Sheets service is currently disconnected ({reason}).")
        except Exception as e:
            self.mode = "disconnected"
            logger.warning(f"Could not connect to live Google Sheet on startup: {e}")

    def reconfigure(self, spreadsheet_id: str, sheet_name: str = "Sheet1") -> Dict[str, Any]:
        """Dynamically reconfigures the active Google Sheet at runtime without restarting the server."""
        clean_id = (spreadsheet_id or "").strip()
        clean_name = (sheet_name or "Sheet1").strip()

        if not clean_id:
            self.spreadsheet_id = ""
            self.sheet_name = clean_name
            self.sheet = None
            self.mode = "disconnected"
            logger.info("Cleared spreadsheet ID. Live Google Sheets synchronization is disconnected.")
            return {
                "success": True,
                "mode": "disconnected",
                "message": "Google Sheets synchronization disconnected.",
                "columns": self._columns,
            }

        try:
            creds = self._get_credentials()
            if not creds:
                return {
                    "success": False,
                    "mode": self.mode,
                    "error": "Google Service Account credentials not found. Please set GOOGLE_SERVICE_ACCOUNT_JSON.",
                }

            client = gspread.authorize(creds)
            try:
                doc = client.open_by_key(clean_id)
            except gspread.SpreadsheetNotFound:
                email = getattr(creds, 'service_account_email', 'the service account')
                return {
                    "success": False,
                    "mode": self.mode,
                    "error": f"Spreadsheet with ID '{clean_id}' was not found. Please verify the ID and ensure the sheet is shared with {email}.",
                }

            try:
                sheet = doc.worksheet(clean_name)
            except gspread.WorksheetNotFound:
                sheet = doc.sheet1
                logger.warning(f"Worksheet '{clean_name}' not found, defaulting to '{sheet.title}'")

            self.client = client
            self.sheet = sheet
            self.spreadsheet_id = clean_id
            self.sheet_name = clean_name
            self._load_or_init_sheet()
            self.mode = "live"
            logger.info(f"Successfully reconfigured to Google Sheet '{clean_id}', tab '{sheet.title}'. Live Mode ACTIVE.")
            return {
                "success": True,
                "mode": "live",
                "sheetTitle": sheet.title,
                "spreadsheetTitle": doc.title,
                "columns": self._columns,
                "message": f"Successfully connected to Google Sheet '{doc.title}' ({sheet.title}).",
            }
        except Exception as e:
            logger.warning(f"Failed to reconfigure Google Sheet: {e}")
            return {
                "success": False,
                "mode": self.mode,
                "error": str(e),
            }

    def test_connection(self, spreadsheet_id: str, sheet_name: str = "Sheet1") -> Dict[str, Any]:
        """Tests Google Sheets connectivity without modifying current live state."""
        clean_id = (spreadsheet_id or "").strip()
        clean_name = (sheet_name or "Sheet1").strip()

        if not clean_id:
            return {"success": False, "error": "Spreadsheet ID is required."}

        try:
            creds = self._get_credentials()
            if not creds:
                return {
                    "success": False,
                    "error": "Google Service Account credentials not found. Please set GOOGLE_SERVICE_ACCOUNT_JSON.",
                }

            client = gspread.authorize(creds)
            try:
                doc = client.open_by_key(clean_id)
            except gspread.SpreadsheetNotFound:
                email = getattr(creds, 'service_account_email', 'the service account')
                return {
                    "success": False,
                    "error": f"Spreadsheet with ID '{clean_id}' was not found. Please verify the ID and ensure it is shared with {email} as Editor.",
                }
            except gspread.exceptions.APIError as api_err:
                return {
                    "success": False,
                    "error": f"Google Sheets API Error: {api_err}",
                }

            try:
                sheet = doc.worksheet(clean_name)
            except gspread.WorksheetNotFound:
                available = [s.title for s in doc.worksheets()]
                return {
                    "success": False,
                    "error": f"Tab '{clean_name}' not found in spreadsheet '{doc.title}'. Available tabs: {', '.join(available)}",
                }

            values = sheet.get_all_values()
            headers = values[0] if values else []
            return {
                "success": True,
                "spreadsheetTitle": doc.title,
                "sheetTitle": sheet.title,
                "rowCount": len(values) - 1 if len(values) > 0 else 0,
                "headers": headers,
                "message": f"Successfully connected to '{doc.title}' (Tab: '{sheet.title}').",
            }
        except Exception as e:
            logger.error(f"Error testing Google Sheets connection: {e}")
            return {"success": False, "error": str(e)}

    def _ensure_columns_cover_index(self, max_idx: int):
        """Ensures _columns covers at least up to max_idx columns."""
        target_len = max(max_idx, 3)
        if len(self._columns) < target_len:
            self._columns = [col_index_to_letter(i) for i in range(1, target_len + 1)]

    def _ensure_columns_cover_cells(self, cells: Dict[str, Any]):
        """Expands _columns if any cell key represents a column beyond current range."""
        max_idx = len(self._columns) if self._columns else 3
        for col in cells.keys():
            idx = letter_to_col_index(str(col))
            if idx > max_idx:
                max_idx = idx
        self._ensure_columns_cover_index(max_idx)

    def _load_or_init_sheet(self):
        """Loads and detects columns from the Google Sheet."""
        try:
            values = self.sheet.get_all_values()
            max_cols = 3
            if values:
                for r in values:
                    max_cols = max(max_cols, len(r))
            self._ensure_columns_cover_index(max_cols)
            logger.info(f"Loaded {len(self._columns)} columns from Google Sheet: {self._columns[0]}..{self._columns[-1]}")
        except Exception as e:
            logger.error(f"Error checking sheet columns: {e}")

    def get_columns(self) -> List[str]:
        """Returns the list of column headers from the active sheet."""
        if not self._columns:
            self._columns = ["A", "B", "C"]
        return list(self._columns)

    def add_column(self, column_name: str) -> List[str]:
        """Adds a new column header to the live sheet."""
        col_name = column_name.strip().upper()
        if not col_name:
            col_name = col_index_to_letter(len(self._columns) + 1)

        idx = letter_to_col_index(col_name)
        if idx > len(self._columns):
            self._ensure_columns_cover_index(idx)
        elif col_name not in self._columns:
            self._columns.append(col_name)

        return list(self._columns)

    def get_all_rows(self) -> List[Dict[str, Any]]:
        """Retrieves all rows with 1-to-1 rowId mapping from live Google Sheet."""
        if self.mode != "live" or not self.sheet:
            return []

        try:
            values = self.sheet.get_all_values()
            if not values:
                return []

            # Dynamically detect columns from actual sheet contents
            max_cols = len(self._columns) if self._columns else 3
            for r in values:
                if len(r) > max_cols:
                    max_cols = len(r)

            self._ensure_columns_cover_index(max_cols)
            columns = list(self._columns)

            rows = []
            for idx, row in enumerate(values, start=1):
                cells = {}
                concat_vals = []
                for c_idx, col in enumerate(columns):
                    val = row[c_idx] if c_idx < len(row) else ""
                    cells[col] = val
                    concat_vals.append(val)

                version = hashlib.md5("|".join(concat_vals).encode()).hexdigest()[:8]
                row_obj = {
                    "rowId": idx,
                    "cells": cells,
                    "version": version
                }
                for col, val in cells.items():
                    row_obj[col] = val

                rows.append(row_obj)
            return rows
        except Exception as e:
            logger.error(f"Error fetching rows from live Google Sheet: {e}")
            raise e

    def get_chunked_rows(self, page: int = 1, limit: int = 25) -> Dict[str, Any]:
        """
        Loads data in chunks / pagination to prevent transferring everything at once.
        Supports dynamic columns and rows.
        """
        all_rows = self.get_all_rows()
        total_rows = len(all_rows)
        columns = self.get_columns()

        safe_limit = max(1, min(limit, 200))
        total_pages = max(1, (total_rows + safe_limit - 1) // safe_limit) if total_rows > 0 else 1
        safe_page = max(1, min(page, total_pages)) if total_rows > 0 else 1

        start_idx = (safe_page - 1) * safe_limit
        end_idx = start_idx + safe_limit
        chunk = all_rows[start_idx:end_idx]

        return {
            "columns": columns,
            "rows": chunk,
            "totalRows": total_rows,
            "page": safe_page,
            "limit": safe_limit,
            "totalPages": total_pages,
            "hash": self.compute_hash(all_rows)
        }

    def update_row(
        self,
        row_id: int,
        cells: Dict[str, str],
        original_cells: Optional[Dict[str, str]] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Updates row with optimistic concurrency control across dynamic columns directly in Google Sheets.
        """
        if self.mode != "live" or not self.sheet:
            raise RuntimeError("Google Sheets service is not connected to an active spreadsheet.")

        self._ensure_columns_cover_cells(cells)
        columns = self.get_columns()
        all_rows = self.get_all_rows()
        target = next((r for r in all_rows if r["rowId"] == row_id), None)

        if not target:
            # Upsert new row at row_id
            clean_cells = {col: str(cells.get(col, "")) for col in columns}
            concat_vals = [clean_cells.get(col, "") for col in columns]
            new_version = hashlib.md5("|".join(concat_vals).encode()).hexdigest()[:8]

            try:
                sheet_row_num = row_id
                last_col_letter = col_index_to_letter(len(columns))
                range_name = f"A{sheet_row_num}:{last_col_letter}{sheet_row_num}"
                row_values = [clean_cells.get(col, "") for col in columns]
                self.sheet.update(range_name=range_name, values=[row_values])
                logger.info(f"Upserted live Google Sheet row {sheet_row_num} across range {range_name}")

                result = {"rowId": row_id, "cells": clean_cells, "version": new_version}
                for col, val in clean_cells.items():
                    result[col] = val
                return result
            except Exception as e:
                logger.error(f"Error upserting live sheet row {row_id}: {e}")
                raise e

        # Conflict check across all dynamic columns
        if original_cells and not force:
            target_cells = target.get("cells", {})
            has_conflict = False
            for col in columns:
                expected = original_cells.get(col, "")
                actual = target_cells.get(col, "")
                if expected != actual:
                    has_conflict = True
                    break

            if has_conflict:
                logger.warning(f"Conflict detected on row {row_id} across dynamic columns!")
                raise RowConflictException(
                    current_row=target,
                    attempted_values=cells
                )

        # Merge new cell values
        updated_cells = dict(target.get("cells", {}))
        for col in columns:
            if col in cells:
                updated_cells[col] = str(cells[col])

        concat_vals = [updated_cells.get(col, "") for col in columns]
        new_version = hashlib.md5("|".join(concat_vals).encode()).hexdigest()[:8]

        try:
            sheet_row_num = row_id
            last_col_letter = col_index_to_letter(len(columns))
            range_name = f"A{sheet_row_num}:{last_col_letter}{sheet_row_num}"
            row_values = [updated_cells.get(col, "") for col in columns]
            self.sheet.update(range_name=range_name, values=[row_values])
            logger.info(f"Updated live Google Sheet row {sheet_row_num} across range {range_name}")

            result = {"rowId": row_id, "cells": updated_cells, "version": new_version}
            for col, val in updated_cells.items():
                result[col] = val
            return result
        except Exception as e:
            logger.error(f"Error updating live sheet row {row_id}: {e}")
            raise e

    def add_row(self, cells: Dict[str, str], row_id: Optional[int] = None) -> Dict[str, Any]:
        """Adds a row to the live Google Sheet. If row_id is provided, writes at that specific position.
        Otherwise appends to the end of the sheet."""
        if self.mode != "live" or not self.sheet:
            raise RuntimeError("Google Sheets service is not connected to an active spreadsheet.")

        self._ensure_columns_cover_cells(cells)
        columns = self.get_columns()
        row_values = [str(cells.get(col, "")) for col in columns]
        clean_cells = {col: str(cells.get(col, "")) for col in columns}
        new_version = hashlib.md5("|".join(row_values).encode()).hexdigest()[:8]

        try:
            if row_id is not None:
                # Write at specific position
                sheet_row_num = row_id
                last_col_letter = col_index_to_letter(len(columns))
                range_name = f"A{sheet_row_num}:{last_col_letter}{sheet_row_num}"
                self.sheet.update(range_name=range_name, values=[row_values])
                logger.info(f"Wrote row at position {sheet_row_num} in Google Sheet (rowId={row_id})")
                result = {"rowId": row_id, "cells": clean_cells, "version": new_version}
                for col, val in clean_cells.items():
                    result[col] = val
                return result
            else:
                # Append to end
                self.sheet.append_row(row_values)
                all_rows = self.get_all_rows()
                new_row = all_rows[-1] if all_rows else {
                    "rowId": 1,
                    "cells": clean_cells,
                    "version": new_version
                }
                logger.info(f"Appended row to live Google Sheet: rowId={new_row['rowId']}")
                return new_row
        except Exception as e:
            logger.error(f"Error adding row to live sheet: {e}")
            raise e

    def delete_row(self, row_id: int) -> bool:
        """Deletes a row by rowId from the live Google Sheet."""
        if self.mode != "live" or not self.sheet:
            raise RuntimeError("Google Sheets service is not connected to an active spreadsheet.")

        try:
            sheet_row_num = row_id
            self.sheet.delete_rows(sheet_row_num)
            logger.info(f"Deleted row {sheet_row_num} from live Google Sheet")
            return True
        except Exception as e:
            logger.error(f"Error deleting row from live sheet: {e}")
            raise e

    def compute_hash(self, rows: Optional[List[Dict[str, Any]]] = None) -> str:
        """Computes deterministic MD5 checksum of current table state for polling diff."""
        if rows is None:
            rows = self.get_all_rows()
        normalized = [{"rowId": r["rowId"], "cells": r.get("cells", {})} for r in rows]
        serialized = json.dumps(normalized, sort_keys=True)
        return hashlib.md5(serialized.encode("utf-8")).hexdigest()

# Singleton instance
sheets_service = GoogleSheetsService()
