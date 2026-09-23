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
 * Safe, non-eval formula evaluation for expressions starting with '='
 */
export function evaluateFormula(
  expr: string,
  rowMap: Map<number, TableRow>,
  visited: Set<string> = new Set()
): string {
  if (!expr.startsWith('=')) return expr;

  const raw = expr.slice(1).trim();
  if (!raw) return '';

  try {
    // 1. Function evaluation: SUM, AVERAGE, COUNT, MIN, MAX
    const fnMatch = raw.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\((.*)\)$/i);
    if (fnMatch) {
      const fnName = fnMatch[1].toUpperCase();
      const argsStr = fnMatch[2];
      const argTokens = argsStr.split(',').map((s) => s.trim());

      const values: number[] = [];
      for (const token of argTokens) {
        if (token.includes(':')) {
          const cells = expandRange(token);
          for (const c of cells) {
            if (visited.has(c)) return '#CYCLE!';
            const nextVisited = new Set(visited);
            nextVisited.add(c);
            const valStr = getCellValue(c, rowMap);
            const resolved = valStr.startsWith('=')
              ? evaluateFormula(valStr, rowMap, nextVisited)
              : valStr;
            if (resolved === '#CYCLE!') return '#CYCLE!';
            const num = parseFloat(resolved.replace(/[^0-9.-]/g, ''));
            if (!isNaN(num)) values.push(num);
          }
        } else {
          const cellCoord = parseCellCoord(token);
          if (cellCoord) {
            const c = token.toUpperCase();
            if (visited.has(c)) return '#CYCLE!';
            const nextVisited = new Set(visited);
            nextVisited.add(c);
            const valStr = getCellValue(c, rowMap);
            const resolved = valStr.startsWith('=')
              ? evaluateFormula(valStr, rowMap, nextVisited)
              : valStr;
            if (resolved === '#CYCLE!') return '#CYCLE!';
            const num = parseFloat(resolved.replace(/[^0-9.-]/g, ''));
            if (!isNaN(num)) values.push(num);
          } else {
            const num = parseFloat(token);
            if (!isNaN(num)) values.push(num);
          }
        }
      }

      if (fnName === 'SUM') {
        const sum = values.reduce((acc, v) => acc + v, 0);
        return String(Math.round(sum * 10000) / 10000);
      }
      if (fnName === 'AVERAGE' || fnName === 'AVG') {
        if (values.length === 0) return '0';
        const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
        return String(Math.round(avg * 10000) / 10000);
      }
      if (fnName === 'COUNT') {
        return String(values.length);
      }
      if (fnName === 'MIN') {
        if (values.length === 0) return '0';
        return String(Math.min(...values));
      }
      if (fnName === 'MAX') {
        if (values.length === 0) return '0';
        return String(Math.max(...values));
      }
    }

    // 2. Safe Arithmetic Expression: e.g. A1 + B1, A1 * 2, (10 + 20) / 2
    // Substitute cell identifiers with their evaluated numerical value
    const cellRefRegex = /\b[A-Z]+[0-9]+\b/gi;
    let hasCycle = false;
    const substituted = raw.replace(cellRefRegex, (ref) => {
      const upperRef = ref.toUpperCase();
      if (visited.has(upperRef)) {
        hasCycle = true;
        return '0';
      }
      const nextVisited = new Set(visited);
      nextVisited.add(upperRef);
      const valStr = getCellValue(upperRef, rowMap);
      const resolved = valStr.startsWith('=')
        ? evaluateFormula(valStr, rowMap, nextVisited)
        : valStr;
      if (resolved === '#CYCLE!') {
        hasCycle = true;
        return '0';
      }
      const num = parseFloat(resolved.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? '0' : String(num);
    });

    if (hasCycle) return '#CYCLE!';

    // Tokenize arithmetic expression safely without eval
    const safeResult = evaluateArithmetic(substituted);
    return isNaN(safeResult) ? '#VALUE!' : String(Math.round(safeResult * 10000) / 10000);
  } catch {
    return '#ERROR!';
  }
}

/**
 * Safe arithmetic evaluator without eval (Shunting-Yard + RPN calculation)
 */
function evaluateArithmetic(expr: string): number {
  // Only allow digits, operators, parentheses, decimal points, spaces
  if (!/^[\d\s+\-*/().%]+$/.test(expr)) {
    return NaN;
  }

  const tokens: string[] = [];
  let numBuf = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === ' ') continue;

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      numBuf += ch;
    } else {
      if (numBuf) {
        tokens.push(numBuf);
        numBuf = '';
      }
      if ('+-*/()'.includes(ch)) {
        // Handle unary minus: e.g. -5 or (-5)
        if (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1] === '(')) {
          numBuf = '-';
        } else {
          tokens.push(ch);
        }
      }
    }
  }
  if (numBuf) tokens.push(numBuf);

  // Convert to RPN using Shunting-Yard algorithm
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const outputQueue: string[] = [];
  const opStack: string[] = [];

  for (const token of tokens) {
    if (!isNaN(Number(token))) {
      outputQueue.push(token);
    } else if ('+-*/'.includes(token)) {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1] !== '(' &&
        precedence[opStack[opStack.length - 1]] >= precedence[token]
      ) {
        outputQueue.push(opStack.pop()!);
      }
      opStack.push(token);
    } else if (token === '(') {
      opStack.push(token);
    } else if (token === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        outputQueue.push(opStack.pop()!);
      }
      opStack.pop(); // discard '('
    }
  }
  while (opStack.length > 0) {
    outputQueue.push(opStack.pop()!);
  }

  // Calculate RPN
  const evalStack: number[] = [];
  for (const token of outputQueue) {
    if (!isNaN(Number(token))) {
      evalStack.push(parseFloat(token));
    } else {
      const b = evalStack.pop() ?? 0;
      const a = evalStack.pop() ?? 0;
      switch (token) {
        case '+': evalStack.push(a + b); break;
        case '-': evalStack.push(a - b); break;
        case '*': evalStack.push(a * b); break;
        case '/':
          if (b === 0) return NaN; // Division by zero
          evalStack.push(a / b);
          break;
      }
    }
  }

  return evalStack.length > 0 ? evalStack[0] : 0;
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
  rowMap?: Map<number, TableRow>
): { display: string; isNumeric: boolean; isFormula: boolean } {
  if (!rawVal && rawVal !== '0') {
    return { display: '', isNumeric: false, isFormula: false };
  }

  const isFormula = rawVal.startsWith('=');
  let effectiveVal = rawVal;

  if (isFormula && rowMap) {
    effectiveVal = evaluateFormula(rawVal, rowMap);
  }

  // If evaluation returned an error string, show it immediately
  if (effectiveVal.startsWith('#')) {
    return { display: effectiveVal, isNumeric: false, isFormula: true };
  }

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
