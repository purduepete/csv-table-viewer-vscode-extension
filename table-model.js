'use strict';

function clampColumnWidth(width, minimum = 80, maximum = 1000) {
    return Math.min(maximum, Math.max(minimum, Math.round(width)));
}

function filterRows(rows, query, columnSelections = []) {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized && columnSelections.every((selection) => selection === null || selection === undefined)) {
        return rows;
    }
    return rows.filter(
        (row) =>
            (!normalized || row.cells.some((cell) => cell.toLocaleLowerCase().includes(normalized))) &&
            columnSelections.every(
                (selection, columnIndex) =>
                    selection === null || selection === undefined || selection.has(row.cells[columnIndex] ?? ''),
            ),
    );
}

function getDistinctValues(
    rows,
    columnIndex,
    collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),
) {
    const values = new Set(rows.map((row) => row.cells[columnIndex] ?? ''));
    return [...values].sort(collator.compare);
}

function selectAllMatchingValues(matchingValues, checked) {
    return checked ? new Set(matchingValues) : new Set();
}

function clearColumnSelection(columnSelections, columnKey) {
    const next = new Map(columnSelections);
    next.delete(columnKey);
    return next;
}

function sortRows(
    rows,
    columnIndex,
    direction,
    collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),
) {
    if (direction === 'none' || columnIndex < 0) {
        return [...rows].sort((left, right) => left.sourceIndex - right.sourceIndex);
    }
    const multiplier = direction === 'descending' ? -1 : 1;
    return [...rows].sort((left, right) => {
        const compared = collator.compare(left.cells[columnIndex] ?? '', right.cells[columnIndex] ?? '');
        return compared === 0 ? left.sourceIndex - right.sourceIndex : compared * multiplier;
    });
}

function nextSortDirection(direction) {
    if (direction === 'none') return 'ascending';
    if (direction === 'ascending') return 'descending';
    return 'none';
}

function getVirtualWindow({ rowCount, rowHeight, scrollTop, viewportHeight, overscan = 20 }) {
    if (rowCount === 0) {
        return { start: 0, end: 0, topHeight: 0, bottomHeight: 0 };
    }
    const visibleStart = Math.floor(scrollTop / rowHeight);
    const visibleEnd = Math.ceil((scrollTop + viewportHeight) / rowHeight);
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(rowCount, visibleEnd + overscan);
    return {
        start,
        end,
        topHeight: start * rowHeight,
        bottomHeight: Math.max(0, (rowCount - end) * rowHeight),
    };
}

function serializeViewState({
    query = '',
    columnSelections = new Map(),
    sortColumnKey = '',
    sortDirection = 'none',
    columnWidths = new Map(),
} = {}) {
    const serializedSelections = {};
    for (const [key, set] of columnSelections) {
        if (set instanceof Set && set.size > 0) {
            serializedSelections[key] = [...set];
        } else if (Array.isArray(set) && set.length > 0) {
            serializedSelections[key] = [...set];
        }
    }

    const serializedWidths = {};
    for (const [key, width] of columnWidths) {
        if (typeof width === 'number' && Number.isFinite(width)) {
            serializedWidths[key] = clampColumnWidth(width);
        }
    }

    return {
        query: typeof query === 'string' ? query : '',
        columnSelections: serializedSelections,
        sortColumnKey: typeof sortColumnKey === 'string' ? sortColumnKey : '',
        sortDirection: sortDirection === 'ascending' || sortDirection === 'descending' ? sortDirection : 'none',
        columnWidths: serializedWidths,
    };
}

function deserializeViewState(raw, columns = []) {
    const validColumnKeys = new Set(columns.map((c) => c.key));
    const result = {
        query: '',
        columnSelections: new Map(),
        sortColumnKey: '',
        sortDirection: 'none',
        columnWidths: new Map(),
    };

    if (!raw || typeof raw !== 'object') {
        return result;
    }

    if (typeof raw.query === 'string') {
        result.query = raw.query;
    }

    if (raw.columnSelections && typeof raw.columnSelections === 'object') {
        for (const [key, values] of Object.entries(raw.columnSelections)) {
            if (validColumnKeys.has(key) && Array.isArray(values)) {
                result.columnSelections.set(key, new Set(values.map(String)));
            }
        }
    }

    if (
        typeof raw.sortColumnKey === 'string' &&
        validColumnKeys.has(raw.sortColumnKey) &&
        (raw.sortDirection === 'ascending' || raw.sortDirection === 'descending')
    ) {
        result.sortColumnKey = raw.sortColumnKey;
        result.sortDirection = raw.sortDirection;
    }

    if (raw.columnWidths && typeof raw.columnWidths === 'object') {
        for (const [key, width] of Object.entries(raw.columnWidths)) {
            if (validColumnKeys.has(key) && typeof width === 'number' && Number.isFinite(width)) {
                result.columnWidths.set(key, clampColumnWidth(width));
            }
        }
    }

    return result;
}

const api = {
    clampColumnWidth,
    clearColumnSelection,
    deserializeViewState,
    filterRows,
    getDistinctValues,
    getVirtualWindow,
    nextSortDirection,
    selectAllMatchingValues,
    serializeViewState,
    sortRows,
};

if (typeof module !== 'undefined') {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.CsvTableModel = api;
}
