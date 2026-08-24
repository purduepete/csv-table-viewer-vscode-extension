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

const api = {
    clampColumnWidth,
    filterRows,
    getDistinctValues,
    getVirtualWindow,
    nextSortDirection,
    selectAllMatchingValues,
    sortRows,
};

if (typeof module !== 'undefined') {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.CsvTableModel = api;
}
