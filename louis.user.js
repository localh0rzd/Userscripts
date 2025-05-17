// ==UserScript==
// @name         Louis Klasse
// @namespace   https://github.com/localh0rzd/Userscripts/
// @version      2025-05-16
// @description  Extrahiert etwaige Sicherheitsklassen bei Kleidung
// @author       You
// @match        https://www.louis.de/produkt*/motorrad-*
// @match        https://www.louis.de/rubrik*/motorrad*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=louis.de
// @require      https://cdn.jsdelivr.net/npm/rxjs@7.8.0/dist/bundles/rxjs.umd.min.js
// @updateURL   https://github.com/localh0rzd/Userscripts/raw/master/louis.user.js
// @version     1.00
// @grant        none
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    const { of } = rxjs;
    const { map, delayMs } = rxjs.operators;

    function timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    let running;

    const doStuff = async () => {
        console.info('doStuff');
        const products = document.querySelectorAll('.product-info__product-name a');
        running = true;
        for(let product of products) {
            const artikel = product.href.match(/\d+$/g);

            let text;
            if(!localStorage.getItem(artikel)) {
                const page = await fetch(product.href);
                if(page.ok){
                    const text = await page.text();
                    // Initialize the DOM parser
                    const parser = new DOMParser()

                    // Parse the text
                    const doc = parser.parseFromString(text, "text/html")

                    const regex = /Klasse \w+/gi
                    let match = text.match(regex);
                    if(!match){
                        match = '&lt;unknown&gt;';

                        for(let property of [...doc.querySelectorAll('[itemprop="additionalProperty"]')]){
                            if(/Klasse/gi.test(property.querySelector('[itemprop="name"]').innerHTML)) {
                               match = `${property.querySelector('[itemprop="name"]').innerHTML}: ${property.querySelector('[itemprop="value"]').innerHTML}`
                               }
                        }
                    }
                    localStorage.setItem(artikel, match);
                }
            }

            text = localStorage.getItem(artikel);
            const span = document.createElement("span");
            span.classList.add('security');

            span.innerHTML = '<br />'+text;

            if(/aaa/gi.test(text)) {
                span.style = 'background-color: #ff00ff;'
            }

            if(!product.parentElement.parentElement.querySelector('.security')) {
                product.parentElement.parentElement.appendChild(span)
            }

        }
        running = false;
    }

    doStuff();


    // Select the node that will be observed for mutations
    const targetNode = document.querySelector('.product-list');
    let timeoutRef;
    // Options for the observer (which mutations to observe)
    const config = { attributes: true, childList: true, subtree: true };

    // Callback function to execute when mutations are observed
    const callback = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                console.log("A child node has been added or removed.");
                clearTimeout(timeoutRef);
                if(!running){
                    timeoutRef = setTimeout(() => doStuff(), 1000);
                } else if(window.location.href != oldHref) {

                }
            } else if (mutation.type === "attributes") {
                console.log(`The ${mutation.attributeName} attribute was modified.`);
            }
        }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);


})();