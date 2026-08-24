'use strict';

const Papa = require('papaparse');

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DATA_ROWS = 50_000;

class FileTooLargeError extends Error {
    constructor(size) {
        super(`This file is ${formatBytes(size)}. Table preview supports files up to ${formatBytes(MAX_FILE_BYTES)}.`);
        this.name = 'FileTooLargeError';
        this.size = size;
    }
}

function formatBytes(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function swapUtf16Bytes(bytes) {
    const swapped = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 2) {
        swapped[index] = bytes[index + 1] ?? 0;
        swapped[index + 1] = bytes[index];
    }
    return swapped;
}

function decodeBytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 BOM', fallback: false };
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE', fallback: false };
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return {
            text: new TextDecoder('utf-16le').decode(swapUtf16Bytes(bytes.subarray(2))),
            encoding: 'UTF-16BE',
            fallback: false,
        };
    }
    try {
        return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8', fallback: false };
    } catch {
        return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252', fallback: true };
    }
}

function makeColumns(headers) {
    const counts = new Map();
    return headers.map((header, index) => {
        const label = String(header ?? '');
        const base = label || `Column ${index + 1}`;
        const count = (counts.get(base) || 0) + 1;
        counts.set(base, count);
        return {
            key: count === 1 ? base : `${base} (${count})`,
            label,
        };
    });
}

function parseText(text, delimiter, rowLimit = MAX_DATA_ROWS) {
    const records = [];
    const warnings = [];
    let truncated = false;
    Papa.parse(text, {
        delimiter,
        skipEmptyLines: 'greedy',
        step(stepResult, parser) {
            warnings.push(...stepResult.errors);
            records.push(stepResult.data);
            if (records.length > rowLimit + 1) {
                truncated = true;
                parser.abort();
            }
        },
    });

    const headers = records.shift() || [];
    const columns = makeColumns(headers);
    if (records.length > rowLimit) {
        truncated = true;
        records.length = rowLimit;
    }
    const rows = records.map((record, sourceIndex) => ({
        sourceIndex,
        cells: columns.map((_, columnIndex) => String(record[columnIndex] ?? '')),
    }));
    for (let index = 0; index < records.length; index += 1) {
        if (records[index].length !== columns.length) {
            warnings.push({
                type: 'FieldMismatch',
                code: 'FieldMismatch',
                message: `Row ${index + 2} has ${records[index].length} fields; expected ${columns.length}.`,
                row: index + 1,
            });
        }
    }
    return { columns, rows, truncated, warnings };
}

function readCsvBytes(input, extension, options = {}) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const maxFileBytes = options.maxFileBytes ?? MAX_FILE_BYTES;
    if (bytes.byteLength > maxFileBytes) {
        throw new FileTooLargeError(bytes.byteLength);
    }
    const decoded = decodeBytes(bytes);
    const parsed = parseText(decoded.text, extension.toLowerCase() === '.tsv' ? '\t' : ',', options.rowLimit);
    return { ...parsed, encoding: decoded.encoding, encodingFallback: decoded.fallback };
}

module.exports = {
    FileTooLargeError,
    MAX_DATA_ROWS,
    MAX_FILE_BYTES,
    decodeBytes,
    makeColumns,
    parseText,
    readCsvBytes,
};
