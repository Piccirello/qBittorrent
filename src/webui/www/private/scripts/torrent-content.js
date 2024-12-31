/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2024 Thomas Piccirello <thomas@piccirello.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * In addition, as a special exception, the copyright holders give permission to
 * link this program with the OpenSSL project's "OpenSSL" library (or with
 * modified versions of it that use the same license as the "OpenSSL" library),
 * and distribute the linked executables. You must obey the GNU General Public
 * License in all respects for all of the code used other than "OpenSSL".  If you
 * modify file(s), you may extend this exception to your version of the file(s),
 * but you are not obligated to do so. If you do not wish to do so, delete this
 * exception statement from your version.
 */

"use strict";

window.qBittorrent ??= {};
window.qBittorrent.TorrentContent ??= (() => {
    const exports = () => {
        return {
            init: init,
            normalizePriority: normalizePriority,
            isFolder: isFolder,
            isDownloadCheckboxExists: isDownloadCheckboxExists,
            createDownloadCheckbox: createDownloadCheckbox,
            updateDownloadCheckbox: updateDownloadCheckbox,
            isPriorityComboExists: isPriorityComboExists,
            createPriorityCombo: createPriorityCombo,
            updatePriorityCombo: updatePriorityCombo,
            updateData: updateData,
            collapseIconClicked: collapseIconClicked,
            expandFolder: expandFolder,
            collapseFolder: collapseFolder,
            clearFilterInputTimer: clearFilterInputTimer
        };
    };

    let torrentFilesTable;
    const FilePriority = window.qBittorrent.FileTree.FilePriority;
    const TriState = window.qBittorrent.FileTree.TriState;
    let torrentFilesFilterInputTimer = -1;
    let onFilePriorityChanged;

    const normalizePriority = (priority) => {
        if (typeof priority !== "number")
            priority = parseInt(priority, 10);

        switch (priority) {
            case FilePriority.Ignored:
            case FilePriority.Normal:
            case FilePriority.High:
            case FilePriority.Maximum:
            case FilePriority.Mixed:
                return priority;
            default:
                return FilePriority.Normal;
        }
    };

    const triStateFromPriority = (priority) => {
        switch (normalizePriority(priority)) {
            case FilePriority.Ignored:
                return TriState.Unchecked;
            case FilePriority.Normal:
            case FilePriority.High:
            case FilePriority.Maximum:
                return TriState.Checked;
            case FilePriority.Mixed:
                return TriState.Partial;
        }
    };

    const normalizeProgress = (progress) => {
        let p = window.qBittorrent.Misc.roundNumber(progress * 100, 1);
        if ((p > 99.9) && (progress < 1))
            p = 99.9;
        return p;
    };

    const isFolder = (fileId) => {
        return fileId === -1;
    };

    const getAllChildren = (id) => {
        const getChildFiles = (node) => {
            rowIds.push(node.rowId);

            if (node.isFolder) {
                node.children.forEach((child) => {
                    getChildFiles(child);
                });
            }
        };

        const node = torrentFilesTable.getNode(id);
        const rowIds = [node.rowId];

        node.children.forEach((child) => {
            getChildFiles(child);
        });

        return rowIds;
    };

    const fileCheckboxClicked = (e) => {
        e.stopPropagation();

        const checkbox = e.target;
        const priority = checkbox.checked ? FilePriority.Normal : FilePriority.Ignored;
        const id = checkbox.dataset.id;

        updatePriority([id], priority);
    };

    const fileComboboxChanged = (e) => {
        const combobox = e.target;
        const priority = combobox.value;
        const id = combobox.dataset.id;

        updatePriority([id], priority);
    };

    const isDownloadCheckboxExists = (id) => {
        return (document.getElementById(`cbPrio${id}`) !== null);
    };

    const createDownloadCheckbox = (id, fileId, checked) => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "cbPrio" + id;
        checkbox.setAttribute("data-id", id);
        checkbox.setAttribute("data-file-id", fileId);
        checkbox.className = "DownloadedCB";
        checkbox.addEventListener("click", fileCheckboxClicked);

        updateCheckbox(checkbox, checked);
        return checkbox;
    };

    const updateDownloadCheckbox = (id, checked) => {
        const checkbox = document.getElementById(`cbPrio${id}`);
        updateCheckbox(checkbox, checked);
    };

    const updateCheckbox = (checkbox, checked) => {
        switch (checked) {
            case TriState.Checked:
                setCheckboxChecked(checkbox);
                break;
            case TriState.Unchecked:
                setCheckboxUnchecked(checkbox);
                break;
            case TriState.Partial:
                setCheckboxPartial(checkbox);
                break;
        }
    };

    const isPriorityComboExists = (id) => {
        return (document.getElementById(`comboPrio${id}`) !== null);
    };

    const createPriorityCombo = (id, fileId, selectedPriority) => {
        const createOption = (priority, isSelected, text) => {
            const option = document.createElement("option");
            option.value = priority.toString();
            option.selected = isSelected;
            option.textContent = text;
            return option;
        };

        const select = document.createElement("select");
        select.id = "comboPrio" + id;
        select.setAttribute("data-id", id);
        select.setAttribute("data-file-id", fileId);
        select.classList.add("combo_priority");
        select.addEventListener("change", fileComboboxChanged);

        select.appendChild(createOption(FilePriority.Ignored, (FilePriority.Ignored === selectedPriority), "QBT_TR(Do not download)QBT_TR[CONTEXT=PropListDelegate]"));
        select.appendChild(createOption(FilePriority.Normal, (FilePriority.Normal === selectedPriority), "QBT_TR(Normal)QBT_TR[CONTEXT=PropListDelegate]"));
        select.appendChild(createOption(FilePriority.High, (FilePriority.High === selectedPriority), "QBT_TR(High)QBT_TR[CONTEXT=PropListDelegate]"));
        select.appendChild(createOption(FilePriority.Maximum, (FilePriority.Maximum === selectedPriority), "QBT_TR(Maximum)QBT_TR[CONTEXT=PropListDelegate]"));

        // "Mixed" priority is for display only; it shouldn't be selectable
        const mixedPriorityOption = createOption(FilePriority.Mixed, (FilePriority.Mixed === selectedPriority), "QBT_TR(Mixed)QBT_TR[CONTEXT=PropListDelegate]");
        mixedPriorityOption.disabled = true;
        select.appendChild(mixedPriorityOption);

        return select;
    };

    const updatePriorityCombo = (id, selectedPriority) => {
        const combobox = document.getElementById(`comboPrio${id}`);
        if (normalizePriority(combobox.value) !== selectedPriority)
            selectComboboxPriority(combobox, normalizePriority(selectedPriority));
    };

    const selectComboboxPriority = (combobox, priority) => {
        const options = combobox.options;
        for (let i = 0; i < options.length; ++i) {
            const option = options[i];
            if (normalizePriority(option.value) === priority)
                option.selected = true;
            else
                option.selected = false;
        }

        combobox.value = priority;
    };

    const getComboboxPriority = (id) => {
        const node = torrentFilesTable.getNode(id.toString());
        return normalizePriority(node.priority, 10);
    };

    const switchGlobalCheckboxState = (e) => {
        e.stopPropagation();

        const rowIds = [];
        const checkbox = document.getElementById("tristate_cb");
        const priority = (checkbox.state === TriState.Checked) ? FilePriority.Ignored : FilePriority.Normal;

        const desiredCheckboxState = (checkbox.state === TriState.Checked) ? TriState.Unchecked : TriState.Checked;
        if (desiredCheckboxState === TriState.Unchecked)
            setCheckboxUnchecked(checkbox);
        else
            setCheckboxChecked(checkbox);

        torrentFilesTable.rows.forEach((row) => {
            const rowId = row.rowId;
            const node = torrentFilesTable.getNode(rowId);
            if (node.checked !== desiredCheckboxState)
                rowIds.push(rowId);
        });

        if (rowIds.length > 0)
            updatePriority(rowIds, priority);
    };

    const updateGlobalCheckbox = () => {
        const checkbox = document.getElementById("tristate_cb");
        if (isAllCheckboxesChecked())
            setCheckboxChecked(checkbox);
        else if (isAllCheckboxesUnchecked())
            setCheckboxUnchecked(checkbox);
        else
            setCheckboxPartial(checkbox);
    };

    const setCheckboxChecked = (checkbox) => {
        checkbox.state = TriState.Checked;
        checkbox.indeterminate = false;
        checkbox.checked = true;
    };

    const setCheckboxUnchecked = (checkbox) => {
        checkbox.state = TriState.Unchecked;
        checkbox.indeterminate = false;
        checkbox.checked = false;
    };

    const setCheckboxPartial = (checkbox) => {
        checkbox.state = TriState.Partial;
        checkbox.indeterminate = true;
    };

    const getCheckboxState = (id) => {
        const node = torrentFilesTable.getNode(id.toString());
        return parseInt(node.checked, 10);
    };

    const isAllCheckboxesChecked = () => {
        return [...torrentFilesTable.rows.values()].every(row => (getCheckboxState(row.rowId) !== TriState.Unchecked));
    };

    const isAllCheckboxesUnchecked = () => {
        return [...torrentFilesTable.rows.values()].every(row => (getCheckboxState(row.rowId) === TriState.Unchecked));
    };

    const setFilePriority = (ids, priority) => {
        priority = normalizePriority(priority);

        if (onFilePriorityChanged) {
            const fileIds = ids.map(rowId => torrentFilesTable.getNode(rowId).fileId);
            onFilePriorityChanged(fileIds, priority);
        }

        ids.forEach((_id) => {
            _id = _id.toString();
            const node = torrentFilesTable.getNode(_id);
            node.priority = priority;
            node.checked = triStateFromPriority(priority);
        });
    };

    const normalizeFiles = (files) => {
        return files.map((file, index) => {
            const ignore = (file.priority === FilePriority.Ignored);
            const checked = (ignore ? TriState.Unchecked : TriState.Checked);
            return {
                fileId: index,
                checked: checked,
                fileName: file.name,
                name: window.qBittorrent.Filesystem.fileName(file.name),
                size: file.size,
                progress: normalizeProgress(file.progress),
                priority: normalizePriority(file.priority),
                availability: file.availability
            };
        });
    };

    const updateData = (data) => {
        const files = normalizeFiles(data);
        const newTree = buildTree(files);
        let diffMap = null;
        try {
            diffMap = window.qBittorrent.FileTree.FileTree.CompareTrees(torrentFilesTable?.fileTree?.root ?? null, newTree.root);
        } catch (error) {
            if (!(error instanceof window.qBittorrent.FileTree.IncompatibleDiffError))
                throw error;
        }

        // update the existing nodes is far more efficient than using a new tree.
        // when updating existing nodes, we can efficiently re-render only the rows/columns that have changed.
        // passing a new tree requires rendering the entire table
        const canUpdateExistingNodes = diffMap !== null;
        if (canUpdateExistingNodes) {
            // copy over changed data
            for (const [rowId, changedColumns] of diffMap.entries()) {
                const node = torrentFilesTable.getNode(rowId);
                const newNode = newTree.getNode(rowId);
                for (const column of changedColumns)
                    node[column] = newNode[column];
            }

            if (diffMap.size > 0) {
                // re-render changes.
                // we've already computed the diff, so pass it along so that it doesn't have to be regenerated.
                // not passing the diff would produce the same result, but be slightly less performant.
                torrentFilesTable.updateTable(false, diffMap);
            }
        } else {
            const selectedFiles = torrentFilesTable.selectedRowsIds();

            torrentFilesTable.populateTable(newTree);

            if (selectedFiles.length > 0)
                torrentFilesTable.reselectRows(selectedFiles);
        }

        if (!canUpdateExistingNodes || (diffMap.size > 0))
            updateGlobalCheckbox();
    };

    const buildTree = (files) => {
        let rowId = 0;
        const rootNode = new window.qBittorrent.FileTree.FolderNode();

        for (const file of files) {
            const pathItems = file.fileName.split(window.qBittorrent.Filesystem.PathSeparator);

            let parent = rootNode;
            const numFolders = pathItems.length - 1;
            // find parent folder
            for (let i = 0; i < numFolders; ++i) {
                const folderName = pathItems[i];
                if (folderName === ".unwanted")
                    continue;

                let folderNode = null;
                if (parent.children !== null)
                    folderNode = parent.children.find(child => child.name === folderName) ?? null;

                if (folderNode === null) {
                    folderNode = new window.qBittorrent.FileTree.FolderNode();
                    folderNode.path = (parent.path === "")
                        ? folderName
                        : [parent.path, folderName].join(window.qBittorrent.Filesystem.PathSeparator);
                    folderNode.name = folderName;
                    folderNode.rowId = rowId.toString();
                    folderNode.root = parent;
                    folderNode.parent = parent;
                    folderNode.depth = i;
                    parent.addChild(folderNode);

                    ++rowId;
                }

                parent = folderNode;
            }

            const isChecked = file.checked ? TriState.Checked : TriState.Unchecked;
            const childNode = new window.qBittorrent.FileTree.FileNode();
            childNode.name = file.name;
            childNode.path = file.fileName;
            childNode.rowId = rowId.toString();
            childNode.fileId = file.fileId;
            childNode.size = file.size;
            childNode.checked = isChecked;
            childNode.progress = file.progress;
            childNode.priority = file.priority;
            childNode.availability = file.availability;
            childNode.root = parent;
            childNode.parent = parent;
            childNode.depth = numFolders;
            parent.addChild(childNode);

            ++rowId;
        };

        return new window.qBittorrent.FileTree.FileTree(rootNode);
    };

    const collapseIconClicked = (element) => {
        const id = element.dataset.id;
        const node = torrentFilesTable.getNode(id);

        if (torrentFilesTable.isFolderCollapsed(node.rowId))
            torrentFilesTable.expandFolder(node.rowId);
        else
            torrentFilesTable.collapseFolder(node.rowId);

        torrentFilesTable.updateTable();
    };

    const expandFolder = (id) => {
        torrentFilesTable.expandFolder(id);
    };

    const collapseFolder = (id) => {
        torrentFilesTable.collapseFolder(id);
    };

    const filesPriorityMenuClicked = (priority) => {
        const selectedRows = torrentFilesTable.selectedRowsIds();
        if (selectedRows.length === 0)
            return;

        updatePriority(selectedRows, priority);
    };

    const updatePriority = (rows, priority) => {
        const uniqueChildRowIds = new Set();
        for (const row of rows) {
            getAllChildren(row).forEach((rowId) => {
                uniqueChildRowIds.add(rowId);
            });
        }

        // update rows and their children
        setFilePriority([...uniqueChildRowIds.keys()], priority);

        // update rows' parent(s)
        for (const row of rows)
            updateParentFolder(row);

        // update all folders
        torrentFilesTable.fileTree.calculateSize();

        // update global state
        updateGlobalCheckbox();

        // re-render
        torrentFilesTable.updateTable();
    };

    const updateParentFolder = (id) => {
        const node = torrentFilesTable.getNode(id);
        const parent = node.parent;
        if (parent === torrentFilesTable.getRoot())
            return;

        const siblings = parent.children;

        let checkedCount = 0;
        let uncheckedCount = 0;
        let indeterminateCount = 0;
        let desiredComboboxPriority = null;
        for (const sibling of siblings) {
            switch (sibling.checked) {
                case TriState.Checked:
                    checkedCount++;
                    break;
                case TriState.Unchecked:
                    uncheckedCount++;
                    break;
                case TriState.Partial:
                    indeterminateCount++;
                    break;
            }

            if (desiredComboboxPriority === null)
                desiredComboboxPriority = getComboboxPriority(sibling.rowId);
            else if (desiredComboboxPriority !== getComboboxPriority(sibling.rowId))
                desiredComboboxPriority = FilePriority.Mixed;
        }

        const currentCheckboxState = parent.checked;
        let desiredCheckboxState;
        if ((indeterminateCount > 0) || ((checkedCount > 0) && (uncheckedCount > 0)))
            desiredCheckboxState = TriState.Partial;
        else if (checkedCount > 0)
            desiredCheckboxState = TriState.Checked;
        else
            desiredCheckboxState = TriState.Unchecked;

        const currentComboboxPriority = getComboboxPriority(parent.rowId);
        if ((currentCheckboxState !== desiredCheckboxState) || (currentComboboxPriority !== desiredComboboxPriority)) {
            const node = torrentFilesTable.getNode(parent.rowId.toString());
            node.priority = desiredComboboxPriority;
            node.checked = desiredCheckboxState;

            updateParentFolder(parent.rowId);
        }
    };

    const init = (tableId, tableClass, onFilePriorityChangedHandler = undefined, onFileRenameHandler = undefined) => {
        if (onFilePriorityChangedHandler !== undefined)
            onFilePriorityChanged = onFilePriorityChangedHandler;

        torrentFilesTable = new tableClass();

        const torrentFilesContextMenu = new window.qBittorrent.ContextMenu.ContextMenu({
            targets: `#${tableId} tr`,
            menu: "torrentFilesMenu",
            actions: {
                Rename: (element, ref) => {
                    if (onFileRenameHandler !== undefined) {
                        const nodes = torrentFilesTable.selectedRowsIds().map(row => torrentFilesTable.getNode(row));
                        onFileRenameHandler(torrentFilesTable.selectedRows, nodes);
                    }
                },

                FilePrioIgnore: (element, ref) => {
                    filesPriorityMenuClicked(FilePriority.Ignored);
                },
                FilePrioNormal: (element, ref) => {
                    filesPriorityMenuClicked(FilePriority.Normal);
                },
                FilePrioHigh: (element, ref) => {
                    filesPriorityMenuClicked(FilePriority.High);
                },
                FilePrioMaximum: (element, ref) => {
                    filesPriorityMenuClicked(FilePriority.Maximum);
                }
            },
            offsets: {
                x: 0,
                y: 2
            },
        });

        torrentFilesTable.setup(tableId, "torrentFilesTableFixedHeaderDiv", torrentFilesContextMenu);
        // inject checkbox into table header
        const tableHeaders = document.querySelectorAll("#torrentFilesTableFixedHeaderDiv .dynamicTableHeader th");
        if (tableHeaders.length > 0) {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = "tristate_cb";
            checkbox.addEventListener("click", switchGlobalCheckboxState);

            const checkboxTH = tableHeaders[0];
            checkboxTH.appendChild(checkbox);
        }

        // default sort by name column
        if (torrentFilesTable.getSortedColumn() === null)
            torrentFilesTable.setSortedColumn("name");

        // listen for changes to torrentFilesFilterInput
        $("torrentFilesFilterInput").addEventListener("input", () => {
            clearTimeout(torrentFilesFilterInputTimer);

            const value = $("torrentFilesFilterInput").value;
            torrentFilesTable.setFilter(value);

            torrentFilesFilterInputTimer = setTimeout(() => {
                torrentFilesFilterInputTimer = -1;

                torrentFilesTable.updateTable();

                if (value.trim() === "")
                    torrentFilesTable.collapseAllFolders();
                else
                    torrentFilesTable.expandAllFolders();
            }, window.qBittorrent.Misc.FILTER_INPUT_DELAY);
        });

        return torrentFilesTable;
    };

    const clearFilterInputTimer = () => {
        clearTimeout(torrentFilesFilterInputTimer);
        torrentFilesFilterInputTimer = -1;
    };

    return exports();
})();
Object.freeze(window.qBittorrent.TorrentContent);

class FileTreeView {
    defaultState = false;
    #renderedState = new Map()
    #state = new Map()

    constructor(fileTree) {
        fileTree.toArray().filter(node => node.isFolder).forEach(node => {
            this.#state.set(node.rowId, { depth: node.depth, collapsed: this.defaultState });
        });
    }

    isCollapsed(id) {
        return this.#state.get(id)?.collapsed ?? this.defaultState;
    }

    collapse(id) {
        if (this.#state.has(id)) {
            const state = this.#state.get(id);
            state.collapsed = true;
        }
    }

    expand(id) {
        if (this.#state.has(id)) {
            const state = this.#state.get(id);
            state.collapsed = false;
        }
    }

    collapseAll(depth = 1) {
        for (const key of this.#state.keys()) {
            if (this.#state.has(key)) {
                const state = this.#state.get(key);
                if (state.depth >= depth) {
                    state.collapsed = true;
                }
            }
        }
    }

    expandAll() {
        for (const key of this.#state.keys())
            this.expand(key)
    }

    render() {
        const unrendered = [...this.#state.entries()].filter(([key, value]) => this.#renderedState.get(key) !== value).map(([key]) => key);
        // make deep copy of map
        this.#renderedState = new Map(JSON.parse(JSON.stringify(Array.from(this.#state))));
        return unrendered;
    }
}
window.qBittorrent.FileTreeView = FileTreeView;
Object.freeze(window.qBittorrent.FileTreeView);
