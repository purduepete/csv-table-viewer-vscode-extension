'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { FileTooLargeError, decodeBytes, makeColumns, parseText, readCsvBytes } = require('../csv-reader');

test('parses quoted commas, escaped quotes, and embedded newlines', () => {
    const parsed = parseText('name,notes\r\n"alpha","one, two"\r\n"beta","line 1\nline 2 and ""quoted"""', ',', 100);
    assert.deepEqual(
        parsed.columns.map((column) => column.label),
        ['name', 'notes'],
    );
    assert.deepEqual(
        parsed.rows.map((row) => row.cells),
        [
            ['alpha', 'one, two'],
            ['beta', 'line 1\nline 2 and "quoted"'],
        ],
    );
});

test('parses TSV and normalizes uneven rows', () => {
    const parsed = readCsvBytes(new TextEncoder().encode('a\tb\n1\t2\n3'), '.tsv');
    assert.deepEqual(
        parsed.rows.map((row) => row.cells),
        [
            ['1', '2'],
            ['3', ''],
        ],
    );
    assert.equal(
        parsed.warnings.some((warning) => warning.code === 'FieldMismatch'),
        true,
    );
});

test('creates stable keys for blank and duplicate headers', () => {
    assert.deepEqual(
        makeColumns(['', 'name', 'name']).map((column) => column.key),
        ['Column 1', 'name', 'name (2)'],
    );
});

test('detects BOM encodings and Windows-1252 fallback', () => {
    assert.equal(decodeBytes(Uint8Array.from([0xef, 0xbb, 0xbf, 0x61])).encoding, 'UTF-8 BOM');
    assert.equal(decodeBytes(Uint8Array.from([0xff, 0xfe, 0x61, 0x00])).text, 'a');
    assert.equal(decodeBytes(Uint8Array.from([0xfe, 0xff, 0x00, 0x61])).text, 'a');
    const fallback = decodeBytes(Uint8Array.from([0x93, 0x61, 0x94]));
    assert.equal(fallback.encoding, 'Windows-1252');
    assert.equal(fallback.text, '“a”');
});

test('caps data rows using lookahead', () => {
    const parsed = parseText('a\n1\n2\n3', ',', 2);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.truncated, true);
});

test('rejects files above the byte limit before parsing', () => {
    assert.throws(() => readCsvBytes(new Uint8Array(11), '.csv', { maxFileBytes: 10 }), FileTooLargeError);
});
