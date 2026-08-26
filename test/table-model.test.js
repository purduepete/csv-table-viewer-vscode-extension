'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    clampColumnWidth,
    clearColumnSelection,
    filterRows,
    getDistinctValues,
    getVirtualWindow,
    nextSortDirection,
    selectAllMatchingValues,
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
