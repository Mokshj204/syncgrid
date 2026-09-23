import asyncio
import logging
import time
from datetime import datetime
import httpx
from app.config import settings
from app.sheets_service import sheets_service

logger = logging.getLogger("sheets_poller")

# Per-row write cooldown duration in seconds.
# After a web-originated write to a row, suppress poller overwrites for that row.
ROW_COOLDOWN_SECONDS = 6.0


class SheetsPoller:
    def __init__(self):
        self.is_running = False
        self._task: asyncio.Task | None = None
        self.last_hash: str = ""
        self.last_sync_time: str = ""
        # Per-row cooldown: { rowId: timestamp_of_last_web_write }
        self._row_cooldowns: dict[int, float] = {}

    async def start(self):
        if not settings.ENABLE_POLLING:
            logger.info("Polling is disabled via ENABLE_POLLING setting.")
            return

        if self.is_running:
            return

        self.is_running = True
        # Establish initial hash
        try:
            initial_rows = sheets_service.get_all_rows()
            self.last_hash = sheets_service.compute_hash(initial_rows)
            self.last_sync_time = datetime.utcnow().isoformat() + "Z"
            logger.info(f"SheetsPoller initialized. Initial state hash: {self.last_hash[:8]}... Mode: {sheets_service.mode}")
        except Exception as e:
            logger.error(f"Error computing initial sheet hash: {e}")

        self._task = asyncio.create_task(self._poll_loop())
        logger.info(f"SheetsPoller started. Polling interval: {settings.POLL_INTERVAL_SECONDS}s")

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("SheetsPoller stopped.")

    def mark_row_written(self, row_id: int):
        """Mark a row as freshly written from the web app.
        The poller will skip overwriting this row in PostgreSQL for ROW_COOLDOWN_SECONDS."""
        self._row_cooldowns[row_id] = time.monotonic()

    def mark_rows_written(self, row_ids: list[int]):
        """Mark multiple rows as freshly written from the web app."""
        now = time.monotonic()
        for rid in row_ids:
            self._row_cooldowns[rid] = now

    def _is_row_cooled_down(self, row_id: int) -> bool:
        """Returns True if the row is still in its write cooldown (should NOT be overwritten by poller)."""
        ts = self._row_cooldowns.get(row_id)
        if ts is None:
            return False
        if time.monotonic() - ts < ROW_COOLDOWN_SECONDS:
            return True
        # Cooldown expired — clean up
        del self._row_cooldowns[row_id]
        return False

    def update_hash(self):
        """Recalculates and stores the current hash after a web-originated write.
        This prevents the next poll cycle from detecting a false diff caused by our own write."""
        try:
            current_rows = sheets_service.get_all_rows()
            self.last_hash = sheets_service.compute_hash(current_rows)
            self.last_sync_time = datetime.utcnow().isoformat() + "Z"
        except Exception as e:
            logger.error(f"Error updating poller hash after web write: {e}")

    async def _poll_loop(self):
        while self.is_running:
            try:
                await asyncio.sleep(settings.POLL_INTERVAL_SECONDS)
                await self.check_for_updates()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in polling loop: {e}", exc_info=False)

    async def check_for_updates(self, source_override: str = "sheets_poller", force: bool = False) -> bool:
        """Checks for differences in Google Sheets data and notifies Node.js gateway if changed."""
        try:
            current_rows = sheets_service.get_all_rows()
            current_hash = sheets_service.compute_hash(current_rows)

            if force or current_hash != self.last_hash:
                logger.info(f"Syncing sheet updates! Old hash: {self.last_hash[:8]} -> New hash: {current_hash[:8]} (force={force})")
                self.last_hash = current_hash
                self.last_sync_time = datetime.utcnow().isoformat() + "Z"

                # Filter out rows that are in their write cooldown to prevent overwriting fresh web edits
                # If force is True (e.g. manual trigger or startup), sync all rows
                filtered_rows = []
                skipped_count = 0
                for r in current_rows:
                    if not force and self._is_row_cooled_down(r["rowId"]):
                        skipped_count += 1
                    else:
                        filtered_rows.append(r)

                if skipped_count > 0:
                    logger.info(f"Skipped {skipped_count} row(s) in cooldown from sync push to Node.js")

                # Only skip if rows exist but were all temporarily held in write cooldown
                if not filtered_rows and len(current_rows) > 0 and source_override == "sheets_poller":
                    return False

                payload = {
                    "event": "sheet_updated",
                    "source": source_override,
                    "timestamp": self.last_sync_time,
                    "columns": sheets_service.get_columns(),
                    "rows": filtered_rows,
                    "mode": sheets_service.mode,
                    "rowCount": len(current_rows)
                }

                # Push event to Node.js WebSocket gateway
                await self._notify_node_gateway(payload)
                return True
            return False
        except Exception as e:
            logger.error(f"Error checking for sheet updates: {e}")
            return False

    async def _notify_node_gateway(self, payload: dict):
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(settings.NODE_INTERNAL_URL, json=payload)
                if resp.status_code == 200:
                    logger.info(f"Successfully dispatched sync event to Node.js gateway ({settings.NODE_INTERNAL_URL})")
                else:
                    logger.warning(f"Node.js gateway returned status {resp.status_code}: {resp.text}")
        except httpx.ConnectError:
            logger.debug("Node.js gateway not reachable (it may be starting or offline). Will retry on next event.")
        except Exception as e:
            logger.error(f"Failed to send sync notification to Node.js gateway: {e}")

poller = SheetsPoller()
