'use strict';

(() => {
    const vscode = acquireVsCodeApi();
    const model = globalThis.CsvTableModel;
    const ROW_HEIGHT = 30;
    const OVERSCAN = 60;
    const DEFAULT_COLUMN_WIDTH = 240;
    const COLUMN_RESIZE_STEP = 16;
    const VALUE_BATCH_SIZE = 250;
    const state = {
        data: null,
        query: '',
        columnSelections: new Map(),
        sortColumn: -1,
        sortDirection: 'none',
        visibleRows: [],
        framePending: false,
        columnWidths: new Map(),
        activeFilter: null,
        visibleValueCount: VALUE_BATCH_SIZE,
    };

    const app = document.getElementById('app');
    const fileName = document.getElementById('file-name');
    const metadata = document.getElementById('metadata');
    const filter = document.getElementById('filter');
    const clearFilter = document.getElementById('clear-filter');
    const openText = document.getElementById('open-text');
    const refresh = document.getElementById('refresh');
    const notice = document.getElementById('notice');
    const scroll = document.getElementById('table-scroll');
    const table = document.getElementById('table');
    const columnGroup = document.getElementById('column-group');
    const headerRow = document.getElementById('header-row');
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    const status = document.getElementById('status');
    const columnFilterMenu = document.getElementById('column-filter-menu');
    const columnFilterTitle = document.getElementById('column-filter-title');
    const closeColumnFilter = document.getElementById('close-column-filter');
    const columnValueSearch = document.getElementById('column-value-search');
    const selectAllValues = document.getElementById('select-all-values');
    const columnValueList = document.getElementById('column-value-list');
    const columnValueStatus = document.getElementById('column-value-status');
    const clearColumnFilter = document.getElementById('clear-column-filter');
    const loadMoreValues = document.getElementById('load-more-values');

    function setNotice(text, kind = 'info') {
        notice.hidden = !text;
        notice.textContent = text;
        notice.dataset.kind = kind;
    }

    function setEmpty(text) {
        emptyState.textContent = text;
        emptyState.hidden = false;
        table.hidden = true;
    }

    function makeSpacer(height, columnCount) {
        const row = document.createElement('tr');
        row.className = 'spacer-row';
        const cell = document.createElement('td');
        cell.colSpan = Math.max(1, columnCount);
        cell.style.height = `${height}px`;
        row.append(cell);
        return row;
    }

    function renderWindow() {
        state.framePending = false;
        if (!state.data || state.visibleRows.length === 0) return;
        const windowRange = model.getVirtualWindow({
            rowCount: state.visibleRows.length,
            rowHeight: ROW_HEIGHT,
            scrollTop: scroll.scrollTop,
            viewportHeight: scroll.clientHeight,
            overscan: OVERSCAN,
        });
        const fragment = document.createDocumentFragment();
        fragment.append(makeSpacer(windowRange.topHeight, state.data.columns.length));
        for (let index = windowRange.start; index < windowRange.end; index += 1) {
            const dataRow = state.visibleRows[index];
            const row = document.createElement('tr');
            row.style.height = `${ROW_HEIGHT}px`;
            for (const value of dataRow.cells) {
                const cell = document.createElement('td');
                cell.textContent = value;
                cell.title = value;
                row.append(cell);
            }
            fragment.append(row);
        }
        fragment.append(makeSpacer(windowRange.bottomHeight, state.data.columns.length));
        tableBody.replaceChildren(fragment);
    }

    function scheduleWindow() {
        if (!state.framePending) {
            state.framePending = true;
            requestAnimationFrame(renderWindow);
        }
    }

    function applyView({ resetScroll = true } = {}) {
        if (!state.data) return;
        const columnSelections = state.data.columns.map((column) => state.columnSelections.get(column.key) ?? null);
        const filtered = model.filterRows(state.data.rows, state.query, columnSelections);
        state.visibleRows = model.sortRows(filtered, state.sortColumn, state.sortDirection);
        const hasColumnFilters = state.columnSelections.size > 0;
        clearFilter.disabled = !state.query && !hasColumnFilters;
        if (resetScroll) scroll.scrollTop = 0;
        const count = state.visibleRows.length;
        status.textContent = `${count.toLocaleString()} of ${state.data.rows.length.toLocaleString()} rows`;
        if (count === 0) {
            tableBody.replaceChildren();
            setEmpty(
                state.query || hasColumnFilters
                    ? 'No rows match the active filters.'
                    : 'This file has headers but no data rows.',
            );
        } else {
            emptyState.hidden = true;
            table.hidden = false;
            renderWindow();
        }
    }

    function columnWidth(column) {
        return state.columnWidths.get(column.key) ?? DEFAULT_COLUMN_WIDTH;
    }

    function renderColumnWidths() {
        const fragment = document.createDocumentFragment();
        let totalWidth = 0;
        for (const column of state.data.columns) {
            const width = columnWidth(column);
            const element = document.createElement('col');
            element.style.width = `${width}px`;
            fragment.append(element);
            totalWidth += width;
        }
        columnGroup.replaceChildren(fragment);
        table.style.width = `${totalWidth}px`;
    }

    function setColumnWidth(index, width) {
        const column = state.data.columns[index];
        state.columnWidths.set(column.key, model.clampColumnWidth(width));
        renderColumnWidths();
    }

    function addResizeHandle(header, column, index) {
        const handle = document.createElement('span');
        handle.className = 'column-resizer';
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', `Resize ${column.label || column.key} column`);
        handle.title = 'Drag to resize. Double-click to reset.';

        let pointerId;
        let startX = 0;
        let startWidth = 0;
        const endResize = () => {
            if (pointerId === undefined) return;
            pointerId = undefined;
            document.body.classList.remove('is-resizing-column');
        };
        handle.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            pointerId = event.pointerId;
            startX = event.clientX;
            startWidth = columnWidth(column);
            handle.setPointerCapture(pointerId);
            document.body.classList.add('is-resizing-column');
        });
        handle.addEventListener('pointermove', (event) => {
            if (event.pointerId === pointerId) setColumnWidth(index, startWidth + event.clientX - startX);
        });
        handle.addEventListener('pointerup', endResize);
        handle.addEventListener('pointercancel', endResize);
        handle.addEventListener('click', (event) => event.stopPropagation());
        handle.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            state.columnWidths.delete(column.key);
            renderColumnWidths();
        });
        handle.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            event.stopPropagation();
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            setColumnWidth(index, columnWidth(column) + direction * COLUMN_RESIZE_STEP);
        });
        header.append(handle);
    }

    function renderHeaders() {
        renderColumnWidths();
        headerRow.replaceChildren();
        state.data.columns.forEach((column, index) => {
            const header = document.createElement('th');
            header.className = 'column-header';
            header.scope = 'col';
            header.setAttribute('aria-sort', index === state.sortColumn ? state.sortDirection : 'none');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'sort-button';
            button.title = column.label || column.key;
            const label = document.createElement('span');
            label.textContent = column.label || column.key;
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.textContent =
                index === state.sortColumn
                    ? state.sortDirection === 'ascending'
                        ? '↑'
                        : state.sortDirection === 'descending'
                          ? '↓'
                          : ''
                    : '';
            button.append(label, indicator);
            button.addEventListener('click', () => {
                if (state.sortColumn !== index) {
                    state.sortColumn = index;
                    state.sortDirection = 'ascending';
                } else {
                    state.sortDirection = model.nextSortDirection(state.sortDirection);
                    if (state.sortDirection === 'none') state.sortColumn = -1;
                }
                renderHeaders();
                applyView();
            });
            const filterButton = document.createElement('button');
            filterButton.type = 'button';
            filterButton.className = 'column-filter-button';
            filterButton.classList.toggle('is-active', state.columnSelections.has(column.key));
            filterButton.setAttribute('aria-label', `Filter ${column.label || column.key} by value`);
            filterButton.setAttribute('aria-haspopup', 'dialog');
            filterButton.setAttribute('aria-expanded', 'false');
            filterButton.title = `Filter ${column.label || column.key} by value`;
            filterButton.innerHTML =
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.5 7.2V19l-3 1v-7.8z"></path></svg>';
            filterButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openColumnFilter(column, index, filterButton);
            });
            header.append(button, filterButton);
            addResizeHandle(header, column, index);
            headerRow.append(header);
        });
    }

    function filteredDistinctValues() {
        const query = columnValueSearch.value.trim().toLocaleLowerCase();
        if (!query) return state.activeFilter.values;
        return state.activeFilter.values.filter((value) => value.toLocaleLowerCase().includes(query));
    }

    function renderColumnValues() {
        if (!state.activeFilter) return;
        const matchingValues = filteredDistinctValues();
        const displayedValues = matchingValues.slice(0, state.visibleValueCount);
        const selection = state.columnSelections.get(state.activeFilter.column.key);
        const fragment = document.createDocumentFragment();
        for (const value of displayedValues) {
            const option = document.createElement('label');
            option.className = 'column-value-option';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !selection || selection.has(value);
            checkbox.addEventListener('change', () => {
                const current = state.columnSelections.get(state.activeFilter.column.key);
                const next = current ? new Set(current) : new Set(state.activeFilter.values);
                if (checkbox.checked) next.add(value);
                else next.delete(value);
                setColumnSelection(state.activeFilter.column.key, next, state.activeFilter.values.length);
                updateFilterButton();
                updateSelectAllState();
                applyView();
            });
            const text = document.createElement('span');
            text.textContent = value || '(blank)';
            text.title = value || '(blank)';
            option.append(checkbox, text);
            fragment.append(option);
        }
        columnValueList.replaceChildren(fragment);
        columnValueStatus.textContent = `${displayedValues.length.toLocaleString()} of ${matchingValues.length.toLocaleString()} values`;
        loadMoreValues.hidden = displayedValues.length >= matchingValues.length;
        updateSelectAllState();
    }

    function setColumnSelection(columnKey, selection, distinctCount) {
        if (selection.size === distinctCount) state.columnSelections.delete(columnKey);
        else state.columnSelections.set(columnKey, selection);
    }

    function updateSelectAllState() {
        if (!state.activeFilter) return;
        const selection = state.columnSelections.get(state.activeFilter.column.key);
        const matchingValues = filteredDistinctValues();
        const effectiveSelection = selection ?? new Set(state.activeFilter.values);
        const selectedMatchingCount = matchingValues.reduce(
            (count, value) => count + (effectiveSelection.has(value) ? 1 : 0),
            0,
        );
        const isExactMatch =
            matchingValues.length > 0 &&
            effectiveSelection.size === matchingValues.length &&
            selectedMatchingCount === matchingValues.length;
        selectAllValues.disabled = matchingValues.length === 0;
        selectAllValues.checked = isExactMatch;
        selectAllValues.indeterminate = !isExactMatch && effectiveSelection.size > 0;
        clearColumnFilter.disabled = !state.columnSelections.has(state.activeFilter.column.key);
    }

    function updateFilterButton() {
        if (!state.activeFilter) return;
        const active = state.columnSelections.has(state.activeFilter.column.key);
        state.activeFilter.button.classList.toggle('is-active', active);
    }

    function positionColumnFilterMenu(button) {
        const bounds = button.getBoundingClientRect();
        const menuWidth = Math.min(340, window.innerWidth - 16);
        const left = Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8));
        columnFilterMenu.style.width = `${menuWidth}px`;
        columnFilterMenu.style.left = `${left}px`;
        columnFilterMenu.style.top = `${Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - 430))}px`;
    }

    function openColumnFilter(column, index, button) {
        if (state.activeFilter) state.activeFilter.button.setAttribute('aria-expanded', 'false');
        state.activeFilter = {
            column,
            button,
            values: model.getDistinctValues(state.data.rows, index),
        };
        state.visibleValueCount = VALUE_BATCH_SIZE;
        columnFilterTitle.textContent = `Filter ${column.label || column.key}`;
        columnValueSearch.value = '';
        button.setAttribute('aria-expanded', 'true');
        columnFilterMenu.hidden = false;
        positionColumnFilterMenu(button);
        renderColumnValues();
        columnValueSearch.focus();
    }

    function closeColumnFilterMenu({ restoreFocus = true } = {}) {
        if (!state.activeFilter) return;
        const button = state.activeFilter.button;
        button.setAttribute('aria-expanded', 'false');
        state.activeFilter = null;
        clearColumnFilter.disabled = true;
        columnFilterMenu.hidden = true;
        if (restoreFocus) button.focus();
    }

    columnValueSearch.addEventListener('input', () => {
        state.visibleValueCount = VALUE_BATCH_SIZE;
        renderColumnValues();
    });
    selectAllValues.addEventListener('change', () => {
        if (!state.activeFilter) return;
        const next = model.selectAllMatchingValues(filteredDistinctValues(), selectAllValues.checked);
        setColumnSelection(state.activeFilter.column.key, next, state.activeFilter.values.length);
        updateFilterButton();
        renderColumnValues();
        applyView();
    });
    clearColumnFilter.addEventListener('click', () => {
        if (!state.activeFilter) return;
        state.columnSelections = model.clearColumnSelection(state.columnSelections, state.activeFilter.column.key);
        updateFilterButton();
        renderColumnValues();
        applyView();
        columnValueSearch.focus();
    });
    loadMoreValues.addEventListener('click', () => {
        state.visibleValueCount += VALUE_BATCH_SIZE;
        renderColumnValues();
    });
    closeColumnFilter.addEventListener('click', () => closeColumnFilterMenu());
    document.addEventListener('pointerdown', (event) => {
        if (
            state.activeFilter &&
            !columnFilterMenu.contains(event.target) &&
            !state.activeFilter.button.contains(event.target)
        ) {
            closeColumnFilterMenu({ restoreFocus: false });
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.activeFilter) {
            event.preventDefault();
            closeColumnFilterMenu();
        }
    });

    function reconcileColumnSelections(payload) {
        const columnIndexes = new Map(payload.columns.map((column, index) => [column.key, index]));
        for (const [columnKey, selection] of state.columnSelections) {
            const columnIndex = columnIndexes.get(columnKey);
            if (columnIndex === undefined) {
                state.columnSelections.delete(columnKey);
                continue;
            }
            const values = model.getDistinctValues(payload.rows, columnIndex);
            const available = new Set(values);
            const next = new Set([...selection].filter((value) => available.has(value)));
            if ((selection.size > 0 && next.size === 0) || next.size === values.length) {
                state.columnSelections.delete(columnKey);
            } else {
                state.columnSelections.set(columnKey, next);
            }
        }
    }

    function showData(payload) {
        closeColumnFilterMenu({ restoreFocus: false });
        const priorColumnKey = state.data?.columns[state.sortColumn]?.key;
        state.data = payload;
        reconcileColumnSelections(payload);
        state.sortColumn = priorColumnKey ? payload.columns.findIndex((column) => column.key === priorColumnKey) : -1;
        if (state.sortColumn < 0) state.sortDirection = 'none';
        fileName.textContent = payload.fileName;
        metadata.textContent = `${payload.rows.length.toLocaleString()} rows · ${payload.columns.length} columns · ${payload.encoding}`;
        let message = '';
        if (payload.truncated)
            message = 'Preview limited to the first 50,000 rows. Filtering and sorting apply to this preview.';
        else if (payload.encodingFallback)
            message = `Decoded as ${payload.encoding}. Verify characters if the source encoding differs.`;
        else if (payload.warnings.length)
            message = `${payload.warnings.length} parse warning${payload.warnings.length === 1 ? '' : 's'} detected.`;
        setNotice(message, payload.warnings.length ? 'warning' : 'info');
        renderHeaders();
        applyView({ resetScroll: false });
        app.setAttribute('aria-busy', 'false');
    }

    let filterTimer;
    filter.addEventListener('input', () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
            state.query = filter.value;
            applyView();
        }, 150);
    });
    clearFilter.addEventListener('click', () => {
        clearTimeout(filterTimer);
        filter.value = '';
        state.query = '';
        state.columnSelections.clear();
        closeColumnFilterMenu({ restoreFocus: false });
        renderHeaders();
        filter.focus();
        applyView();
    });
    openText.addEventListener('click', () => vscode.postMessage({ type: 'openText' }));
    refresh.addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
    scroll.addEventListener('scroll', scheduleWindow, { passive: true });
    new ResizeObserver(scheduleWindow).observe(scroll);

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'loading') {
            app.setAttribute('aria-busy', 'true');
            status.textContent = 'Loading...';
        } else if (message.type === 'data') {
            showData(message.payload);
        } else if (message.type === 'externalChange') {
            setNotice('The file changed outside this table. Refresh to load the latest content.', 'warning');
        } else if (message.type === 'fileTooLarge' || message.type === 'error') {
            state.data = null;
            setNotice(message.message, 'error');
            setEmpty(
                message.type === 'fileTooLarge'
                    ? 'This file is too large for table preview.'
                    : 'The table could not be loaded.',
            );
            status.textContent = 'Not loaded';
            app.setAttribute('aria-busy', 'false');
        }
    });

    vscode.postMessage({ type: 'ready' });
})();
