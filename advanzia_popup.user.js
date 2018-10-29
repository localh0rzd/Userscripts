// ==UserScript==
// @name         Advanzia Auto-Transactions
// @namespace    https://github.com/localh0rzd/Userscripts/
// @version      0.1
// @description  Kill mTAN popup and open transactions
// @author       localh0rzd
// @updateURL    https://github.com/localh0rzd/Userscripts/raw/master/jira_context_menu.user.js
// @match        https://mein.advanzia.com/icc/assisto/nav/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    setTimeout(function(){
        if(window.location.href.match('#creditcard_startpage')){
            try{
                document.querySelector('.popup_closeX').click();
            }catch(err){}
            document.querySelector('.cnav2').click();
        }
    }, 1000);

})();