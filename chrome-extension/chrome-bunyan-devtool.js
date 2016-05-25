/* global chrome */

console.log(chrome.tabs)

chrome.devtools.panels.create(
    'Bunyan',
    null, // No icon path
    'Panel/BunyanDevToolPanel.html',
    null // no callback needed
);
