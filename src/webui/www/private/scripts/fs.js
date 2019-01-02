'use strict';

var QB_EXT = '.!qB';

var pathSeparator = '/';

new Request({
    url: 'api/v2/app/pathSeparator',
    method: 'get',
    onSuccess: function(response) {
        pathSeparator = response;
    }
}).send();

// This file is the JavaScript implementation of base/utils/fs.cpp

/**
 * Converts a path to a string suitable for display.
 * This function makes sure the directory separator used is consistent
 * with the OS being run.
 */
function toNativePath(path) {
    // TODO implement?
}

function fromNativePath(path) {
    if (pathSeparator === '/')
        return path;
    return path.replace(/\\/g, '/');
}

/**
 * Returns the file extension part of a file name.
 */
function fileExtension(filename) {
    var name = filename.replace(QB_EXT, '');
    var pointIndex = name.lastIndexOf('.');
    if (pointIndex >= 0)
        return name.substring(pointIndex + 1);
    return '';
}

function fileName(filepath) {
    var slashIndex = filepath.lastIndexOf(pathSeparator);
    if (slashIndex === -1)
        return filepath;
    return filepath.substring(slashIndex + 1);
}

function folderName(filepath) {
    var slashIndex = filepath.lastIndexOf(pathSeparator);
    if (slashIndex === -1)
        return filepath;
    return filepath.substring(0, slashIndex);
}
