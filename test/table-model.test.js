'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
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
} = require('../table-model');

const rows = [
    { sourceIndex: 0, cells: ['beta', '10'] },
    { sourceIndex: 1, cells: ['Alpha', '2'] },
    { sourceIndex: 2, cells: ['alpha', '1'] },
];

test('clamps and rounds column widths', () => {
    assert.equal(clampColumnWidth(42), 80);
    assert.equal(clampColumnWidth(241.6), 242);
    assert.equal(clampColumnWidth(1200), 1000);
});

test('filters across cells without case sensitivity', () => {
    assert.deepEqual(
        filterRows(rows, 'ALPHA').map((row) => row.sourceIndex),
        [1, 2],
    );
});

test('combines global and per-column value selections with AND semantics', () => {
    assert.deepEqual(
        filterRows(rows, 'a', [new Set(['Alpha']), new Set(['2'])]).map((row) => row.sourceIndex),
        [1],
    );
    assert.deepEqual(
        filterRows(rows, '', [null, new Set(['10', '1'])]).map((row) => row.sourceIndex),
        [0, 2],
    );
    assert.deepEqual(filterRows(rows, '', [new Set()]), []);
});

test('columns without a value selection preserve the original rows', () => {
    assert.equal(filterRows(rows, '', [null, null]), rows);
    assert.deepEqual(filterRows([{ sourceIndex: 0, cells: ['only'] }], '', [null, new Set(['value'])]), []);
});

test('lists distinct column values in natural order', () => {
    assert.deepEqual(getDistinctValues(rows, 0), ['Alpha', 'alpha', 'beta']);
    assert.deepEqual(getDistinctValues(rows, 1), ['1', '2', '10']);
    assert.deepEqual(getDistinctValues([{ sourceIndex: 0, cells: [] }], 0), ['']);
});

test('select all keeps only values matching the checklist search', () => {
    assert.deepEqual([...selectAllMatchingValues(['Alpha', 'alpha'], true)], ['Alpha', 'alpha']);
    assert.deepEqual([...selectAllMatchingValues(['Alpha', 'alpha'], false)], []);
    assert.deepEqual([...selectAllMatchingValues([], true)], []);
});

test('clears only the requested column selection without mutating the input', () => {
    const selections = new Map([
        ['name', new Set(['Alpha'])],
        ['quantity', new Set(['2'])],
    ]);

    const cleared = clearColumnSelection(selections, 'name');

    assert.deepEqual([...cleared.keys()], ['quantity']);
    assert.deepEqual([...cleared.get('quantity')], ['2']);
    assert.deepEqual([...selections.keys()], ['name', 'quantity']);
});

test('sort is stable and none restores source order', () => {
    assert.deepEqual(
        sortRows(rows, 0, 'ascending').map((row) => row.sourceIndex),
        [1, 2, 0],
    );
    assert.deepEqual(
        sortRows(rows, 1, 'ascending').map((row) => row.sourceIndex),
        [2, 1, 0],
    );
    assert.deepEqual(
        sortRows([...rows].reverse(), 0, 'none').map((row) => row.sourceIndex),
        [0, 1, 2],
    );
});

test('cycles sort direction', () => {
    assert.equal(nextSortDirection('none'), 'ascending');
    assert.equal(nextSortDirection('ascending'), 'descending');
    assert.equal(nextSortDirection('descending'), 'none');
});

test('calculates bounded virtual windows', () => {
    assert.deepEqual(
        getVirtualWindow({ rowCount: 1000, rowHeight: 28, scrollTop: 0, viewportHeight: 280, overscan: 5 }),
        {
            start: 0,
            end: 15,
            topHeight: 0,
            bottomHeight: 27_580,
        },
    );
    const end = getVirtualWindow({
        rowCount: 1000,
        rowHeight: 28,
        scrollTop: 27_720,
        viewportHeight: 280,
        overscan: 5,
    });
    assert.equal(end.end, 1000);
    assert.equal(end.bottomHeight, 0);
});

test('serializes and deserializes viewState round-trip', () => {
    const columns = [
        { key: 'col_0', label: 'Name' },
        { key: 'col_1', label: 'Age' },
    ];
    const original = {
        query: 'Alice',
        columnSelections: new Map([
            ['col_0', new Set(['Alice', 'Alicia'])],
            ['col_1', new Set()],
        ]),
        sortColumnKey: 'col_0',
        sortDirection: 'descending',
        columnWidths: new Map([
            ['col_0', 280],
            ['col_1', 120],
        ]),
    };

    const serialized = serializeViewState(original);
    assert.deepEqual(serialized, {
        query: 'Alice',
        columnSelections: {
            col_0: ['Alice', 'Alicia'],
        },
        sortColumnKey: 'col_0',
        sortDirection: 'descending',
        columnWidths: {
            col_0: 280,
            col_1: 120,
        },
    });

    const deserialized = deserializeViewState(serialized, columns);
    assert.equal(deserialized.query, 'Alice');
    assert.deepEqual([...deserialized.columnSelections.get('col_0')], ['Alice', 'Alicia']);
    assert.equal(deserialized.columnSelections.has('col_1'), false);
    assert.equal(deserialized.sortColumnKey, 'col_0');
    assert.equal(deserialized.sortDirection, 'descending');
    assert.equal(deserialized.columnWidths.get('col_0'), 280);
    assert.equal(deserialized.columnWidths.get('col_1'), 120);
});

test('deserializes gracefully when columns are missing or malformed', () => {
    const columns = [{ key: 'col_0', label: 'Name' }];
    const malformed = {
        query: 123,
        columnSelections: {
            col_0: ['Alice'],
            deleted_col: ['Bob'],
        },
        sortColumnKey: 'deleted_col',
        sortDirection: 'invalid',
        columnWidths: {
            col_0: 'wide',
            deleted_col: 300,
        },
    };

    const deserialized = deserializeViewState(malformed, columns);
    assert.equal(deserialized.query, '');
    assert.deepEqual([...deserialized.columnSelections.get('col_0')], ['Alice']);
    assert.equal(deserialized.columnSelections.has('deleted_col'), false);
    assert.equal(deserialized.sortColumnKey, '');
    assert.equal(deserialized.sortDirection, 'none');
    assert.equal(deserialized.columnWidths.size, 0);

    const empty = deserializeViewState(null, columns);
    assert.equal(empty.query, '');
    assert.equal(empty.columnSelections.size, 0);
    assert.equal(empty.sortColumnKey, '');
    assert.equal(empty.sortDirection, 'none');
    assert.equal(empty.columnWidths.size, 0);
});
