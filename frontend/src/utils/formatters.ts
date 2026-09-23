import { CellFormat, TableRow } from '../types';

/**
 * Parse cell coordinates e.g. "A1", "B24" -> { col: "A", rowId: 1 }
 */
export function parseCellCoord(ref: string): { col: string; rowId: number } | null {
  const match = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: match[1], rowId: parseInt(match[2], 10) };
}

export const colToIdx = (col: string): number => {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx;
};

export const idxToCol = (idx: number): string => {
  let letter = '';
  let temp = idx;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
};

/**
 * Expand range reference e.g. "A1:A3" or "A1:B2" -> ["A1", "A2", "A3"]
 */
export function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [rangeStr.trim().toUpperCase()];

  const start = parseCellCoord(parts[0]);
  const end = parseCellCoord(parts[1]);
  if (!start || !end) return [rangeStr.trim().toUpperCase()];

  const startColIdx = Math.min(colToIdx(start.col), colToIdx(end.col));
  const endColIdx = Math.max(colToIdx(start.col), colToIdx(end.col));
  const startRow = Math.min(start.rowId, end.rowId);
  const endRow = Math.max(start.rowId, end.rowId);

  const cells: string[] = [];
  for (let c = startColIdx; c <= endColIdx; c++) {
    const colName = idxToCol(c);
    for (let r = startRow; r <= endRow; r++) {
      cells.push(`${colName}${r}`);
    }
  }
  return cells;
}

/**
 * Get raw cell value from row map
 */
export function getCellValue(ref: string, rowMap: Map<number, TableRow>): string {
  const parsed = parseCellCoord(ref);
  if (!parsed) return '';
  const row = rowMap.get(parsed.rowId);
  if (!row) return '';
  return String(row.cells?.[parsed.col] ?? row[parsed.col] ?? '');
}

/**
 * Formula evaluation (Pass-through: formula math calculations disabled, syncs raw cell values directly)
 */
export function evaluateFormula(
  expr: string,
  _rowMap?: Map<number, TableRow>,
  _visited?: Set<string>
): string {
  return expr;
}

/**
 * Format a number with thousands separators and decimal precision
 */
export function formatNumber(
  val: number,
  decimals: number = 2,
  useGrouping: boolean = true
): string {
  if (isNaN(val)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  }).format(val);
}

/**
 * Format cell value based on cell format settings and row context
 */
export function formatCellValue(
  rawVal: string,
  format?: CellFormat,
  _rowMap?: Map<number, TableRow>
): { display: string; isNumeric: boolean; isFormula: boolean } {
  if (!rawVal && rawVal !== '0') {
    return { display: '', isNumeric: false, isFormula: false };
  }

  const isFormula = rawVal.startsWith('=');
  const effectiveVal = rawVal;

  const formatType = format?.type || 'general';
  const decimals = format?.decimals !== undefined ? format.decimals : 2;

  const isNumericStr = (val: string): boolean => {
    const s = val.trim();
    if (!s) return false;
    return !isNaN(Number(s));
  };

  switch (formatType) {
    case 'number': {
      if (!isNumericStr(effectiveVal)) return { display: effectiveVal, isNumeric: false, isFormula };
      const num = Number(effectiveVal.trim());
      return {
        display: formatNumber(num, decimals, format?.useGrouping !== false),
        isNumeric: true,
        isFormula,
      };
    }

    case 'currency_usd': {
      if (!isNumericStr(effectiveVal)) return { display: effectiveVal, isNumeric: false, isFormula };
      const num = Number(effectiveVal.trim());
      return {
        display: `$${formatNumber(num, decimals, true)}`,
        isNumeric: true,
        isFormula,
      };
    }

    case 'currency_inr': {
      if (!isNumericStr(effectiveVal)) return { display: effectiveVal, isNumeric: false, isFormula };
      const num = Number(effectiveVal.trim());
      return {
        display: `₹${formatNumber(num, decimals, true)}`,
        isNumeric: true,
        isFormula,
      };
    }

    case 'currency_eur': {
      if (!isNumericStr(effectiveVal)) return { display: effectiveVal, isNumeric: false, isFormula };
      const num = Number(effectiveVal.trim());
      return {
        display: `€${formatNumber(num, decimals, true)}`,
        isNumeric: true,
        isFormula,
      };
    }

    case 'currency_gbp': {
      if (!isNumericStr(effectiveVal)) return { display: effectiveVal, isNumeric: false, isFormula };
      const num = Number(effectiveVal.trim());
      return {
        display: `£${formatNumber(num, decimals, true)}`,
        isNumeric: true,
        isFormula,
      };
    }

    case 'percent': {
      if (!isNumericStr(effectiveVal)) return { display: effectiveVal, isNumeric: false, isFormula };
      const num = Number(effectiveVal.trim());
      const percentVal = Math.abs(num) < 1 ? num * 100 : num;
      return {
        display: `${formatNumber(percentVal, decimals, true)}%`,
        isNumeric: true,
        isFormula,
      };
    }

    case 'date_short': {
      const d = new Date(effectiveVal);
      if (isNaN(d.getTime())) return { display: effectiveVal, isNumeric: false, isFormula };
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return { display: `${yyyy}-${mm}-${dd}`, isNumeric: false, isFormula };
    }

    case 'date_long': {
      const d = new Date(effectiveVal);
      if (isNaN(d.getTime())) return { display: effectiveVal, isNumeric: false, isFormula };
      return {
        display: d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        isNumeric: false,
        isFormula,
      };
    }

    case 'time': {
      // If time format e.g. "14:30" or ISO string
      if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i.test(effectiveVal.trim())) {
        return { display: effectiveVal.trim(), isNumeric: false, isFormula };
      }
      const d = new Date(effectiveVal);
      if (!isNaN(d.getTime())) {
        return {
          display: d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          isNumeric: false,
          isFormula,
        };
      }
      return { display: effectiveVal, isNumeric: false, isFormula };
    }

    case 'datetime': {
      const d = new Date(effectiveVal);
      if (isNaN(d.getTime())) return { display: effectiveVal, isNumeric: false, isFormula };
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const timeStr = d.toLocaleTimeString('en-US', { hour12: false });
      return { display: `${yyyy}-${mm}-${dd} ${timeStr}`, isNumeric: false, isFormula };
    }

    case 'scientific': {
      const num = parseFloat(effectiveVal.replace(/[^0-9.-]/g, ''));
      if (isNaN(num)) return { display: effectiveVal, isNumeric: false, isFormula };
      return {
        display: num.toExponential(decimals).toUpperCase(),
        isNumeric: true,
        isFormula,
      };
    }

    case 'text': {
      return { display: String(effectiveVal), isNumeric: false, isFormula };
    }

    case 'general':
    default: {
      // Auto-detection
      const cleanNum = parseFloat(effectiveVal);
      if (!isNaN(cleanNum) && String(cleanNum) === effectiveVal.trim()) {
        return { display: effectiveVal, isNumeric: true, isFormula };
      }
      return { display: effectiveVal, isNumeric: false, isFormula };
    }
  }
}
