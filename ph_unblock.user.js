// ==UserScript==
// @name         ph unblock
// @namespace    https://github.com/localh0rzd/Userscripts/
// @version      0.1
// @description  Remove that nasty VK auth dialog
// @author       localh0rzd
// @updateURL    https://github.com/localh0rzd/Userscripts/raw/master/ph_unblock.user.js
// @match        https://*.pornhub.com/*
// @match        https://pornhub.com/*
// @run-at      document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    for(let elem of document.querySelectorAll("div[id^='age-verification']")){
        document.body.removeChild(elem)
    }
})();