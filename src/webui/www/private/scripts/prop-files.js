'use strict';

var is_seed = true;
var current_hash = "";

var FilePriority = {
    "Ignored": 0,
    "Normal": 1,
    "High": 6,
    "Maximum": 7,
    "Mixed": -1
};

var normalizePriority = function(priority) {
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

var fileCheckboxChanged = function(e) {
    var checkbox = e.target;
    var priority = checkbox.checked ? FilePriority.Normal : FilePriority.Ignored;
    var id = checkbox.get('data-id');

    setFilePriority(id, priority);
    setGlobalCheckboxState();
    return true;
};

var fileComboboxChanged = function(e) {
    var combobox = e.target;
    var newPriority = combobox.value;
    var id = combobox.get('data-id');

    setFilePriority(id, newPriority);
};

var isDownloadCheckboxExists = function(id) {
    return ($('cbPrio' + id) !== null);
};

var createDownloadCheckbox = function(id, download) {
    var checkbox = new Element('input');
    checkbox.set('type', 'checkbox');
    if (download)
        checkbox.set('checked', 'checked');
    checkbox.set('id', 'cbPrio' + id);
    checkbox.set('data-id', id);
    checkbox.set('class', 'DownloadedCB');
    checkbox.addEvent('change', fileCheckboxChanged);
    return checkbox;
};

var updateDownloadCheckbox = function(id, download) {
    var checkbox = $('cbPrio' + id);
    checkbox.checked = download;
};

var isPriorityComboExists = function(id) {
    return ($('comboPrio' + id) !== null);
};

var createPriorityOptionElement = function(priority, selected, html) {
    var elem = new Element('option');
    elem.set('value', priority.toString());
    elem.set('html', html);
    if (selected)
        elem.setAttribute('selected', '');
    return elem;
};

var createPriorityCombo = function(id, selectedPriority) {
    var select = new Element('select');
    select.set('id', 'comboPrio' + id);
    select.set('data-id', id);
    select.set('disabled', is_seed);
    select.addClass('combo_priority');
    select.addEvent('change', fileComboboxChanged);

    createPriorityOptionElement(FilePriority.Ignored, (FilePriority.Ignored === selectedPriority), 'QBT_TR(Do not download)QBT_TR[CONTEXT=PropListDelegate]').injectInside(select);
    createPriorityOptionElement(FilePriority.Normal, (FilePriority.Normal === selectedPriority), 'QBT_TR(Normal)QBT_TR[CONTEXT=PropListDelegate]').injectInside(select);
    createPriorityOptionElement(FilePriority.High, (FilePriority.High === selectedPriority), 'QBT_TR(High)QBT_TR[CONTEXT=PropListDelegate]').injectInside(select);
    createPriorityOptionElement(FilePriority.Maximum, (FilePriority.Maximum === selectedPriority), 'QBT_TR(Maximum)QBT_TR[CONTEXT=PropListDelegate]').injectInside(select);

    return select;
};

var updatePriorityCombo = function(id, selectedPriority) {
    var combobox = $('comboPrio' + id);

    if (parseInt(combobox.value) !== selectedPriority)
        selectComboboxPriority(combobox, selectedPriority);

    if (combobox.disabled !== is_seed)
        combobox.disabled = is_seed;
};

var selectComboboxPriority = function(combobox, priority) {
    var options = combobox.options;
    for (var i = 0; i < options.length; ++i) {
        var option = options[i];
        if (parseInt(option.value) === priority)
            option.setAttribute('selected', '');
        else
            option.removeAttribute('selected');
    }

    combobox.value = priority;
};

var switchCheckboxState = function() {
    var rows = [];
    var priority = FilePriority.Ignored;

    if ($('tristate_cb').state === "checked") {
        setGlobalCheckboxUnchecked();
        // set file priority for all checked to Ignored
        torrentFilesTable.getFilteredAndSortedRows().forEach(function(row) {
            if (row.full_data.checked)
                rows.push(row.full_data.fileId);
        });
    }
    else {
        setGlobalCheckboxChecked();
        priority = FilePriority.Normal;
        // set file priority for all unchecked to Normal
        torrentFilesTable.getFilteredAndSortedRows().forEach(function(row) {
            if (!row.full_data.checked)
                rows.push(row.full_data.fileId);
        });
    }

    if (rows.length > 0)
        setFilePriority(rows, priority);
};

var setGlobalCheckboxState = function() {
    if (isAllCheckboxesChecked())
        setGlobalCheckboxChecked();
    else if (isAllCheckboxesUnchecked())
        setGlobalCheckboxUnchecked();
    else
        setGlobalCheckboxPartial();
};

var setGlobalCheckboxChecked = function() {
    $('tristate_cb').state = "checked";
    $('tristate_cb').indeterminate = false;
    $('tristate_cb').checked = true;
};

var setGlobalCheckboxUnchecked = function() {
    $('tristate_cb').state = "unchecked";
    $('tristate_cb').indeterminate = false;
    $('tristate_cb').checked = false;
};

var setGlobalCheckboxPartial = function() {
    $('tristate_cb').state = "partial";
    $('tristate_cb').indeterminate = true;
};

var isAllCheckboxesChecked = function() {
    var checkboxes = $$('input.DownloadedCB');
    for (var i = 0; i < checkboxes.length; ++i) {
        if (!checkboxes[i].checked)
            return false;
    }
    return true;
};

var isAllCheckboxesUnchecked = function() {
    var checkboxes = $$('input.DownloadedCB');
    for (var i = 0; i < checkboxes.length; ++i) {
        if (checkboxes[i].checked)
            return false;
    }
    return true;
};

var setFilePriority = function(id, priority) {
    if (current_hash === "") return;
    var ids = Array.isArray(id) ? id : [id];

    clearTimeout(loadTorrentFilesDataTimer);
    new Request({
        url: 'api/v2/torrents/filePrio',
        method: 'post',
        data: {
            'hash': current_hash,
            'id': ids.join('|'),
            'priority': priority
        },
        onComplete: function() {
            loadTorrentFilesDataTimer = loadTorrentFilesData.delay(1000);
        }
    }).send();

    ids.forEach(function(_id) {
        var combobox = $('comboPrio' + _id);
        if (combobox !== null)
            selectComboboxPriority(combobox, priority);
    });
};

var loadTorrentFilesDataTimer;
var loadTorrentFilesData = function() {
    if ($('prop_files').hasClass('invisible')
        || $('propertiesPanel_collapseToggle').hasClass('panel-expand')) {
        // Tab changed, don't do anything
        return;
    }
    var new_hash = torrentsTable.getCurrentTorrentHash();
    if (new_hash === "") {
        torrentFilesTable.clear();
        clearTimeout(loadTorrentFilesDataTimer);
        loadTorrentFilesDataTimer = loadTorrentFilesData.delay(5000);
        return;
    }
    if (new_hash != current_hash) {
        torrentFilesTable.clear();
        current_hash = new_hash;
    }
    var url = new URI('api/v2/torrents/files?hash=' + current_hash);
    new Request.JSON({
        url: url,
        noCache: true,
        method: 'get',
        onComplete: function() {
            clearTimeout(loadTorrentFilesDataTimer);
            loadTorrentFilesDataTimer = loadTorrentFilesData.delay(5000);
        },
        onSuccess: function(response) {
            if (!response) {
                torrentFilesTable.clear();
                return;
            }

            is_seed = (response.length > 0) ? response[0].is_seed : true;
            var files = [];
            response.each(function(file) {
                var progress = (file.progress * 100).round(1);
                if ((progress === 100) && (file.progress < 1))
                    progress = 99.9;

                var name = escapeHtml(file.name);
                var row = {
                    fileId: files.length,
                    checked: (file.priority !== FilePriority.Ignored),
                    fileName: name,
                    name: fileName(name),
                    size: file.size,
                    progress: progress,
                    priority: normalizePriority(file.priority),
                    remaining: (file.size * (1.0 - file.progress)),
                    availability: file.availability
                };

                if ((row.progress === 100) && (file.progress < 1))
                    row.progress = 99.9;

                files.push(row);
            });

            addFilesToTable(files);
            setGlobalCheckboxState();
        }
    }).send();
};

var updateTorrentFilesData = function() {
    clearTimeout(loadTorrentFilesDataTimer);
    loadTorrentFilesData();
};

var addFilesToTable = function(files) {
    var selectedFiles = torrentFilesTable.selectedRowsIds();
    var rowId = 0;

    var FileNode = new Class({
        name: "",
        size: 0,
        data: null,
        root: null,
        children: [],

        initialize: function(name, size, root, data) {
            this.name = name;
            this.size = size;
            this.root = root;
            this.data = data;
        },
        addChild: function(node) {
            this.children.push(node);
        },
        // fullName: function() {
        //     if (this.root === null)
        //         return '/' + this.name;
        //     return this.root.fullName() + '/' + this.name;
        // }
    })

    var rootNode = new FileNode(null, null, null, null);
    files.each(function(file) {
        // TODO folders should sort properly
        // TODO add folder icon to folder rows
        // TODO setting the priority on a folder should set all its subchildren, recursively
        // TODO figure out ".unwanted" and QBT_EXT, and if those settings are being honored like the GUI
        // TODO see functionality in TorrentContentModelFolder and TorrentContentModelFile
        // TODO does the GUI do anything else special for the content table? any other logic like QBT_EXT or .unwanted?

        var parent = rootNode;

        var path = fromNativePath(file.fileName);
        var pathFolders = path.split('/');
        pathFolders.pop();
        pathFolders.each(function(folder) {
            if (folder === '.unwanted')
                return;

            var parentNode = null;
            if (parent.children !== null) {
                for (var i = 0; i < parent.children.length; ++i) {
                    var childFolder = parent.children[i];
                    if (childFolder.name === folder) {
                        parentNode = childFolder;
                        break;
                    }
                }
            }
            if (parentNode === null) {
                parentNode = new FileNode(folder, 0, parent, null);
                parent.addChild(parentNode);
            }

            parent = parentNode;
        });

        parent.addChild(new FileNode(file.name, file.size, parent, file));
    }.bind(this));

    var addChildrenToTable = function(node) {
        if (node.data) {
            node.data.rowId = rowId;
            torrentFilesTable.updateRowData(node.data);
        }
        else {
            torrentFilesTable.updateRowData({
                rowId: rowId,
                fileId: -1,
                checked: false,
                name: node.name,
                size: 0,
                progress: 0,
                priority: normalizePriority(1),
                remaining: 0,
                availability: 0
            });
        }
        ++rowId;

        node.children.each(function(child) {
            addChildrenToTable(child);
        });

    };

    rootNode.children.each(function(child) {
        addChildrenToTable(child);
    });
    torrentFilesTable.updateTable(false);
    torrentFilesTable.altRow();

    if (selectedFiles.length > 0)
        torrentFilesTable.reselectRows(selectedFiles);
};

var torrentFilesContextMenu = new ContextMenu({
    targets: '#torrentFilesTableDiv tr',
    menu: 'torrentFilesMenu',
    actions: {
        RenameFile: function(element, ref) {
            var selectedRows = torrentFilesTable.selectedRowsIds();
            if (selectedRows.length !== 1) return;

            renameFileFN(selectedRows[0]);
        },
        FilePrioIgnore: function(element, ref) {
            var selectedRows = torrentFilesTable.selectedRowsIds();
            if (selectedRows.length === 0) return;

            setFilePriority(selectedRows, FilePriority.Ignored);
        },
        FilePrioNormal: function(element, ref) {
            var selectedRows = torrentFilesTable.selectedRowsIds();
            if (selectedRows.length === 0) return;

            setFilePriority(selectedRows, FilePriority.Normal);
        },
        FilePrioHigh: function(element, ref) {
            var selectedRows = torrentFilesTable.selectedRowsIds();
            if (selectedRows.length === 0) return;

            setFilePriority(selectedRows, FilePriority.High);
        },
        FilePrioMaximum: function(element, ref) {
            var selectedRows = torrentFilesTable.selectedRowsIds();
            if (selectedRows.length === 0) return;

            setFilePriority(selectedRows, FilePriority.Maximum);
        }
    },
    offsets: {
        x: -15,
        y: 2
    },
    onShow: function() {
        var selectedRows = torrentFilesTable.selectedRowsIds();

        if (selectedRows.length === 1)
            this.showItem('RenameFile');
        else
            this.hideItem('RenameFile');

        if (is_seed)
            this.hideItem('FilePrio');
        else
            this.showItem('FilePrio');
    }
});

var renameFileFN = function(fileId) {
    var row = torrentFilesTable.rows.get(fileId);
    var name = encodeURIComponent(row.full_data.name);
    var fileId = row.full_data.fileId;
    new MochaUI.Window({
        id: 'renamePage',
        title: "QBT_TR(Rename)QBT_TR[CONTEXT=PropertiesWidget]",
        loadMethod: 'iframe',
        contentURL: 'rename.html?hash=' + current_hash + '&id=' + fileId + '&name=' + name,
        scrollbars: false,
        resizable: false,
        maximizable: false,
        paddingVertical: 0,
        paddingHorizontal: 0,
        width: 250,
        height: 100
    });
};

torrentFilesTable.setup('torrentFilesTableDiv', 'torrentFilesTableFixedHeaderDiv', torrentFilesContextMenu);
// inject checkbox into table header
var tableHeaders = $$('#torrentFilesTableFixedHeaderDiv .dynamicTableHeader th');
if (tableHeaders.length > 0) {
    var checkbox = new Element('input');
    checkbox.set('type', 'checkbox');
    checkbox.set('id', 'tristate_cb');
    checkbox.addEvent('click', switchCheckboxState);

    var checkboxTH = tableHeaders[0];
    checkbox.injectInside(checkboxTH);
}

// default sort by name column
if (torrentFilesTable.getSortedColunn() === null)
    torrentFilesTable.setSortedColumn('name');
