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
            IncompatibleDiffError: IncompatibleDiffError,
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

    class IncompatibleDiffError extends Error {}

    class FileTree {
        /** @type FileNode|FolderNode|null */
        root = null;
        #nodeMap = new Map();

        /**
         * @param {FileNode|FolderNode} root
         */
        constructor(root) {
            this.root = root;
            this.generateNodeMap(root);
            this.calculateSize();
        }

        static CompareTrees(rootA, rootB) {
            const diffMap = new Map();
            this.#CompareNode(rootA, rootB, diffMap);
            return diffMap;
        }

        static #CompareNode(nodeA, nodeB, diffMap) {
            if ((nodeA === null) || (nodeB === null))
                throw new IncompatibleDiffError(`node cannot be null`);
            if (nodeA.rowId !== nodeB.rowId)
                throw new IncompatibleDiffError(`Row ids ${nodeA.rowId} and ${nodeB.rowId} do not match`);
            if (nodeA.isRoot() !== nodeB.isRoot())
                throw new IncompatibleDiffError(`Row id ${nodeA.rowId} is root in one tree but not other`);
            if (nodeA.fileId !== nodeB.fileId)
                throw new IncompatibleDiffError(`Row id ${nodeA.rowId} does not have same file id in both trees`);
            if (nodeA.isFolder !== nodeB.isFolder)
                throw new IncompatibleDiffError(`Row id ${nodeA.rowId} is folder in one tree but not the other`);
            if (nodeA.depth !== nodeB.depth)
                throw new IncompatibleDiffError(`Row id ${nodeA.rowId} does not have same depth in both trees`);
            if (nodeA.children.length !== nodeB.children.length)
                throw new IncompatibleDiffError(`Row id ${nodeA.rowId} does not have same number of children in both trees`);

            if (!nodeA.isRoot()) {
                const nodeASerialized = nodeA.serialize();
                const nodeBSerialized = nodeB.serialize();
                const changedColumns = [];
                Object.entries(nodeASerialized).forEach(([key, value]) => {
                    if (value !== nodeBSerialized[key])
                        changedColumns.push(key);
                });
                if (changedColumns.length > 0)
                    diffMap.set(nodeA.rowId, changedColumns);
            }

            if (nodeA.isFolder) {
                // children must be in the same order for comparison
                nodeA.children.sort((node1, node2) => node1.path.localeCompare(node2.path));
                nodeB.children.sort((node1, node2) => node1.path.localeCompare(node2.path));

                for (let i = 0; i < nodeA.children.length; ++i) {
                    const childNodeA = nodeA.children[i];
                    const childNodeB = nodeB.children[i];
                    this.#CompareNode(childNodeA, childNodeB, diffMap);
                }
            }

        }

        clear() {
            this.root = null;
            this.#nodeMap.clear();
        }

        clone() {
            const setRoot = (node, root) => {
                node.root = root;
                node.children.forEach(child => setRoot(child, root));
            };

            const newRoot = this.root.clone();
            newRoot.children.forEach(child => setRoot(child, newRoot));
            return newRoot;
        }

        getRoot() {
            return this.root;
        }

        /**
         * @param {FileNode|FolderNode} node
         */
        generateNodeMap(node) {
            // don't store root node in map
            if (node.root !== null)
                this.#nodeMap.set(node.rowId, node);

            node.children.forEach((child) => {
                this.generateNodeMap(child);
            });
        }

        getNode(rowId) {
            return this.#nodeMap.get(rowId) ?? null;
        }

        getRowId(node) {
            return node.rowId;
        }

        calculateSize() {
            this.root.calculateSize();
        }

        /**
         * Returns the nodes in dfs order
         */
        toArray() {
            const nodes = [];
            if (this.root !== null) {
                this.root.children.forEach((node) => {
                    this.#getArrayOfNodes(node, nodes);
                });
            }
            return nodes;
        }

        serialize() {
            const filesMap = new Map();
            this.toArray().filter(node => !node.isFolder).forEach(node => {
                filesMap.set(node.fileId, node.serialize());
            });
            return filesMap;
        }

        #getArrayOfNodes(node, array) {
            array.push(node);
            node.children.forEach((child) => {
                this.#getArrayOfNodes(child, array);
            });
        }
    };

    class FileNode {
        rowId = null;
        /** @type number|null */
        fileId = null;
        /** @type FileNode|FolderNode|null */
        root = null;

        name = "";
        path = "";
        size = 0;
        checked = TriState.Unchecked;
        remaining = 0;
        progress = 0;
        priority = FilePriority.Normal;
        availability = 0;
        depth = 0;

        isFolder = false;
        /** @type (FileNode | FolderNode)[] */
        children = [];

        isRoot() {
            return this.root === null;
        }

        isIgnored() {
            return this.priority === FilePriority.Ignored;
        }

        calculateSize() {
            if (this.isIgnored())
                this.remaining = 0;
            else
                this.remaining = (this.size * (1.0 - (this.progress / 100)));
        }

        serialize() {
            return {
                fileId: this.fileId,
                checked: this.checked,
                name: this.name,
                path: this.path,
                size: this.size,
                progress: this.progress,
                priority: this.priority,
                remaining: this.remaining,
                availability: this.availability
            };
        }

        clone() {
            const newNode = new FileNode();
            newNode.rowId = this.rowId;
            newNode.fileId = this.fileId;
            newNode.isFolder = this.isFolder;
            newNode.depth = this.depth;
            newNode.name = this.name;
            newNode.path = this.path;
            newNode.size = this.size;
            newNode.checked = this.checked;
            newNode.remaining = this.remaining;
            newNode.progress = this.progress;
            newNode.priority = this.priority;
            newNode.availability = this.availability;
            return newNode;
        }
    };

    class FolderNode extends FileNode {
        isFolder = true;
        fileId = -1;

        /**
         * When true, the folder's `checked` state will be calculately automatically based on its children
         */
        autoCalculateCheckedState = true;

        /**
         * @param {FileNode|FolderNode} node
         */
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

            this.children.forEach((node) => {
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

                if (!node.isIgnored()) {
                    remaining += node.remaining;
                    progress += (node.progress * node.size);
                    availability += (node.availability * node.size);
                }
            });

            this.size = size;
            this.remaining = remaining;
            this.checked = this.autoCalculateCheckedState ? checked : TriState.Checked;
            this.progress = (size > 0) ? (progress / size) : 0;
            this.priority = priority;
            this.availability = (size > 0) ? (availability / size) : 0;
        }

        clone() {
            const newNode = super.clone();
            newNode.children = this.children.map(child => child.clone());
            return newNode;
        }
    }

    return exports();
})();
Object.freeze(window.qBittorrent.FileTree);
