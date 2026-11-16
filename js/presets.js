/**
 * presets.js - Presets index
 * Mirrors all built-in sample scripts into global.PRESETS for backward compatibility.
 * Co-authored & architected with Google DeepMind Antigravity.
 */
(function(global) {
    'use strict';
    global.PRESETS = global.PRESETS || {};

    if (global.SAMPLE_FOLDER_FILES && Array.isArray(global.SAMPLE_FOLDER_FILES)) {
        global.SAMPLE_FOLDER_FILES.forEach(function(item) {
            if (item && item.filename) {
                global.PRESETS[item.filename] = {
                    name: item.title || item.filename,
                    filename: item.filename,
                    path: item.path || ('samples/' + item.filename),
                    code: item.code
                };
            }
        });
    }
})(typeof window !== 'undefined' ? window : this);

