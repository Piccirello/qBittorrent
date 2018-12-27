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

/*
 * JS counterpart of the function in src/base/utils/fs.cpp
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
