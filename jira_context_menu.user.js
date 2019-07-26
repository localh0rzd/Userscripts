// ==UserScript==
// @name         Improve JIRA context menu
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Because context menus should not be skyscrapers
// @author       localh0rzd
// @updateURL    https://github.com/localh0rzd/Userscripts/raw/master/jira_context_menu.user.js
// @match        http*://*/secure/RapidBoard.jspa*
// @grant GM_addStyle
// ==/UserScript==

GM_addStyle(".ghx-avatar-img { width: 40px !important; height: 40px !important; }")

const callback = (mutationsList, observer) => {
    for(const mutation of mutationsList) {
        if (mutation.target.id == 'cp-image-preview') {
            mutation.target.addEventListener("click", e => document.querySelector("button#cp-control-panel-close").click())
        }
    }
};
const observer = new MutationObserver(callback);
observer.observe(document.body, config);

document.addEventListener("contextmenu", e => {
    try{
        const menu = document.querySelector("#gh-ctx-menu-trigger_drop");
        menu.style.overflowY = "scroll"
        console.info(e)
        console.info(window.innerHeight)
        if(e.clientY > (window.innerHeight / 2)){
            menu.style.top = `${e.clientY - 400}px`
        } else {
            menu.style.top = `${e.clientY}px`
        }
        menu.style.height = "400px"
    } catch(error) {
        console.warn(error)}
    })