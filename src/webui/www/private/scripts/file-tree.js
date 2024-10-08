/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2019  Thomas Piccirello <thomas.piccirello@gmail.com>
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
window.qBittorrent.FileTree ??= (() => {
    const exports = () => {
        return {
            FilePriority: FilePriority,
            TriState: TriState,
            FileTree: FileTree,
            FileNode: FileNode,
            FolderNode: FolderNode,
        };
    };

    const FilePriority = {
        Ignored: 0,
        Normal: 1,
        High: 6,
        Maximum: 7,
        Mixed: -1
    };
    Object.freeze(FilePriority);

    const TriState = {
        Unchecked: 0,
        Checked: 1,
        Partial: 2
    };
    Object.freeze(TriState);

    class FileTree {
        root = null;
        #nodeMap = new Map();

        setRoot(root) {
            this.root = root;
            this.generateNodeMap(root);

            if (this.root.isFolder)
                this.root.calculateSize();
        }

        getRoot() {
            return this.root;
        }

        generateNodeMap(node) {
            // don't store root node in map
            if (node.root !== null)
                this.#nodeMap.set(node.rowId, node);

            node.children.each((child) => {
                this.generateNodeMap(child);
            });
        }

        getNode(rowId) {
            return this.#nodeMap.get(Number.parseInt(rowId, 10)) ?? null;
        }

        getRowId(node) {
            return node.rowId;
        }

        /**
         * Returns the nodes in dfs order
         */
        toArray() {
            const nodes = [];
            this.root.children.each((node) => {
                this.#getArrayOfNodes(node, nodes);
            });
            return nodes;
        }

        #getArrayOfNodes(node, array) {
            array.push(node);
            node.children.each((child) => {
                this.#getArrayOfNodes(child, array);
            });
        }
    };

    class FileNode {
        name = "";
        path = "";
        rowId = null;
        fileId = null;
        size = 0;
        checked = TriState.Unchecked;
        remaining = 0;
        progress = 0;
        priority = FilePriority.Normal;
        availability = 0;
        depth = 0;
        root = null;
        isFolder = false;
        children = [];
    };

    class FolderNode extends FileNode {
        isFolder = true;
        fileId = -1;

        /**
         * Will automatically tick the checkbox for a folder if all subfolders and files are also ticked
         */
        autoCheckFolders = true;

        addChild(node) {
            this.children.push(node);
        }

        /**
         * Recursively calculate size of node and its children
         */
        calculateSize() {
            let size = 0;
            let remaining = 0;
            let progress = 0;
            let availability = 0;
            let checked = TriState.Unchecked;
            let priority = FilePriority.Normal;

            let isFirstFile = true;

            this.children.each((node) => {
                if (node.isFolder)
                    node.calculateSize();

                size += node.size;

                if (isFirstFile) {
                    priority = node.priority;
                    checked = node.checked;
                    isFirstFile = false;
                }
                else {
                    if (priority !== node.priority)
                        priority = FilePriority.Mixed;
                    if (checked !== node.checked)
                        checked = TriState.Partial;
                }

                const isIgnored = (node.priority === FilePriority.Ignored);
                if (!isIgnored) {
                    remaining += node.remaining;
                    progress += (node.progress * node.size);
                    availability += (node.availability * node.size);
                }
            });

            this.size = size;
            this.remaining = remaining;
            this.checked = this.autoCheckFolders ? checked : TriState.Checked;
            this.progress = (progress / size);
            this.priority = priority;
            this.availability = (availability / size);
        }
    }

    return exports();
})();
Object.freeze(window.qBittorrent.FileTree);
