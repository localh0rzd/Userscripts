// ==UserScript==
// @name         Unfuck Bybit P2P
// @namespace    http://tampermonkey.net/
// @updateURL   https://github.com/localh0rzd/Userscripts/raw/master/bybit.user.js
// @downloadURL   https://github.com/localh0rzd/Userscripts/raw/master/bybit.user.js
// @version     1.02
// @author       You
// @match        https://www.bybit.com/en/p2p/buy/USDT/RUB
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bybit.com
// @grant        unsafeWindow
// @run-at document-start
// ==/UserScript==

(function() {
    'use strict';

    const originalFetch = window.fetch;
    const root = unsafeWindow || window;

    const badFlag = [
        /Cпред до 7.2 пpoцeнтов/i,
        /Веду до результата/i,
        /Даю рабочую cвязky/i,
        /Выкуплю Ваши USDT/i,
        /Свяzkи на ByB/i,
        /Строго ТБАНК/i,
        /Принимаю ТОЛЬКО с тиньк/i,
        /ТОЛЬКО Т БАНК/i,
        /СО СБЕРБАНКА НЕ ПРИНИМАЮ/i,
        /только\s+через\s+T-БАНК/i,
        /ТОЛЬКО\s+С\s+Т\s+БАНКА/i,
        /Принимаю оплату с Т[- ]Банка/i,
        /(ТОЛЬКО|исключительно|строго) ?с? Т[- ]БАНКА/i,
        /(ТОЛЬКО|исключительно|строго)? ?с? ?(ТИНЬ?КОФФ?|т-банк|Тиньков)/i,
        /Сοбираю  партнёрοв/i,
        /пᴀᴘᴛʜᴇ̈ᴘᴏʙ/i,
        /за НАЛИЧНЫЕ/i,
        /Наличный обмен/i,
        /Pyypl/i,
        /Т-БАНК QR/i,
        /с Т.?банка?/i,
        /ПРИНИМАЮ (ТОЛЬКО|СТРОГО) С ТИНЬКОФФ/i,
        /строго по СБП с Т БАНКА/i,
        /ТОЛЬКО С БАНКАМИ: Т-БАНК/i,
        /ТОЛЬКО\s+ТБАНК/i,
        /Со сбера не принимаю/i,
        /СО СБЕРА, ВТБ, АЛЬФА НЕ ПРИНИМАЮ/i,
        /только( с)? (тинькофф|t.?банк)/i,
        /С ТБАНКа по СБП/i,
        /Прин[еи]маю(.*) с Тинькофф/i,
        /ТОЛЬКО С "Т.?БАНК.*/i,
        /Оплата только с Тиньков/i,
        /Перевод СТРОГО с ТИНЬКОФФ/i,
        /ПРИМУ ТОЛЬКО С Т БАНКА/i,
        /НЕ ПРИНИМАЮ ПЛАТЕЖИ ОТ СБЕРБАНКА/i,
        /только с ПРИЛОЖЕНИЯ ТИНЬКОФФ/i,
        /КРОМЕ СБЕР/i,
        /Ищу партнеров/i,
        /набираю команду/i,
        /Актуал тематика/i,
        /Платежи от СБЕРБАНКА, УРАЛСИБ, ЯНДЕКСА, ГАЗПРОМА, АЛЬФЫ, МТС, РАЙФ, ОТП, ПОЧТА, БСПБ, ЮНИСТРИМ НЕ ПРИНИМАЮ/i
    ]

    const goodFlag = [
    /(Перевод|только) (со )?СБЕР/i,
    ]

    const doFlag = elem => {

        console.info(elem.innerHTML)
        if(badFlag.some(regex => regex.test(elem.innerHTML))) {
          elem.parentElement.parentElement.style.backgroundColor = 'rgba(255,0,0,0.4)';
            const tr = elem.parentElement.parentElement;
            tr.style.display = 'none';
            console.info('removed');
        }
                else if(goodFlag.some(regex => regex.test(elem.innerHTML))) {
          elem.parentElement.parentElement.style.backgroundColor = 'rgba(0,255,0,0.4)';
        }

    }

    root.fetch = function(...args) {
        const url = args[0];
        const options = args[1] || {};

        return originalFetch.apply(this, args).then(response => {
            // Clone the response, as it can only be read once.
            const clonedResponse = response.clone();

            // Log the response details.
            if(clonedResponse.url == 'https://www.bybit.com/x-api/fiat/otc/item/online'){
                for(const span of document.querySelectorAll('span.custom-text')) {
                delete span.parentElement.parentElement.style.backgroundColor;
                }
                //console.log('Fetch response:', clonedResponse);
                clonedResponse.json().then(json => {

                    // Your callback function
                    function onStableDOM() {
                        const currentPage = parseInt(document.querySelector('.pagination-item-active a').innerHTML);
                        const rows = [...document.querySelectorAll('td:first-child')];
                        rows.shift();

                        for(const [index, row] of rows.entries()) {
                            let span = document.querySelector(`span#_${index}.custom-text`);
                            if(!span) {
                                span = document.createElement('span')
                                span.classList.add('custom-text');
                                span.id = `_${index}`;
                            }

                            span.innerHTML = json.result.items[index]?.remark;
                            //if(/сбер/gi.test(span.innerHTML)) {
                            //    row.parentElement.style.backgroundColor = 'rgba(0,255,0,0.4)'
                            //}
                            row.appendChild(span);
                            doFlag(span);
                        }
                        observer.disconnect()
                    }

                    // Timer variable for debounce
                    let debounceTimer;

                    // Create the observer
                    const observer = new MutationObserver((mutationsList, obs) => {
                        // Clear previous timer on every mutation
                        clearTimeout(debounceTimer);

                        // Set a new timer
                        debounceTimer = setTimeout(() => {
                            onStableDOM();
                        }, 300);
                    });

                    // Start observing the document (or a specific element)
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true
                    });


                    console.log('Fetch response JSON:', json);
                });
            }
            return response;
        });
    };
})();