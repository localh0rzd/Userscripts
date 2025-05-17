// ==UserScript==
// @name         Louis Klasse
// @namespace   https://github.com/localh0rzd/Userscripts/
// @description  Extrahiert etwaige Sicherheitsklassen bei Kleidung
// @author       You
// @match        https://www.louis.de/produkt*/motorrad-*
// @match        https://www.louis.de/rubrik*/motorrad*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=louis.de
// @require      https://cdn.jsdelivr.net/npm/rxjs@7.8.0/dist/bundles/rxjs.umd.min.js
// @updateURL   https://github.com/localh0rzd/Userscripts/raw/master/louis.user.js
// @downloadURL   https://github.com/localh0rzd/Userscripts/raw/master/louis.user.js
// @version     1.04
// @grant        none
// @run-at      document-idle
// ==/UserScript==

(function () {
    'use strict';

    const { of } = rxjs;
    const { fromFetch } = rxjs.fetch;
    const { map, delay, switchMap, concatMap, tap } = rxjs.operators;

    let subscription;
    let oldHref;
    const parser = new DOMParser()

    const doStuff = () => {
        const products = [...document.querySelectorAll('.product-info__product-name a')];
        products.forEach(product => {
            product.parentElement.parentElement.parentElement.style.opacity = 0.25;
        });
        subscription = rxjs.of(...products).pipe(
            concatMap(product => {
                const artikel = product.href.match(/\d+$/g).join();

                if (localStorage.getItem(artikel)) {
                    return of({ product, match: localStorage.getItem(artikel) })
                } else {
                    return of(product).pipe(
                        delay(500),
                        switchMap(product =>
                            fromFetch(product.href).pipe(
                                switchMap(response => response.text()),
                                map(page => {
                                    const doc = parser.parseFromString(page, "text/html")
                                    let match;
                                    const regex = /Klasse \w+/gi

                                    for (let property of [...doc.querySelectorAll('[itemprop="additionalProperty"]')]) {
                                        if (/Klasse/gi.test(property.querySelector('[itemprop="name"]').innerHTML)) {
                                            match = `${property.querySelector('[itemprop="name"]').innerHTML.trim()}: ${property.querySelector('[itemprop="value"]').innerHTML.trim()}`
                                        }
                                    }

                                    if (!match) {
                                        match = page.match(regex) ?? '&lt;unknown&gt;';
                                    }

                                    localStorage.setItem(artikel, match);
                                    return { product, match };
                                }),
                            )))
                }
            }),
            tap(({ product, match }) => {
                const span = document.createElement("span");
                span.classList.add('security');

                span.innerHTML = '<br />' + match;

                if (/aaa/gi.test(match)) {
                    product.parentElement.parentElement.style = 'background-color: #ff00ff;'
                }

                if (!product.parentElement.parentElement.querySelector('.security')) {
                    product.parentElement.parentElement.appendChild(span);
                }

                product.parentElement.parentElement.parentElement.style.opacity = 1;
            })
        ).subscribe();

    }

    doStuff();

    const targetNode = document.querySelector('.product-list');
    const config = { childList: true, subtree: true };

    const callback = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                if (window.location.href != oldHref) {
                    subscription?.unsubscribe();
                    setTimeout(() => doStuff(), 2000);
                    oldHref = window.location.href;
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);


})();