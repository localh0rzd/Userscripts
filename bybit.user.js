// ==UserScript==
// @name         Unfuck Bybit P2P
// @namespace    http://tampermonkey.net/
// @updateURL    https://github.com/localh0rzd/Userscripts/raw/master/bybit.user.js
// @downloadURL  https://github.com/localh0rzd/Userscripts/raw/master/bybit.user.js
// @version      2.17
// @author       You
// @match        https://www.bybit.com/*/p2p*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bybit.com
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ---------- config ----------
    const DEFAULT_CURRENCY = 'RUB';
    // Labels exactly as shown in the "All Payment Methods" dropdown
    const DEFAULT_PAYMENTS = ['Bank Transfer', 'Mobile Top-up'];
    const DEFAULT_REFRESH = '5'; // seconds, as in the refresh dropdown: '5', '10', '20'
    const HIDE_BAD = true; // false = only tint bad rows red instead of hiding

    // Each regex is also tested against a copy with Latin look-alikes turned Cyrillic (see toCyrillic),
    // so "Т-БAНК" with a Latin A is caught without separate Latin variants.
    const badFlag = [
        /Перевод\s+зарубеж/i,                                              // "Перевод зарубеж" / "Перевод зарубежный"
        // Tinkoff / T-Bank mentioned anywhere. Same as your old catch-all
        // (its "только/строго ... с" prefix was fully optional), widened to "тиньк…".
        /тиньк|тинкофф?|tinkoff|[tт]-банк|\bt[\s.—–-]*bank/i,
        // "только/строго/исключительно (с) Т банк", "ТБАНК", «Т-Банк», extra spaces
        /(только|исключительно|строго)\s*(с\s*)?["«]?[tт](?:[\s-]*|.)банк/i,
        // "с Т банка", "с Т-Банка", "С ТБАНКа"
        /с [tт].?банк/i,
        // spaced / bracketed / unicode-hyphen spellings after "с"/"из":
        // "с т б а н к а", "с Т - б а н к а", "с (Т) БАНКА", "из Т‑Банка", "из ТБАНК"
        /(с\s+|из\s+)\(?[tт]\)?[\s.\-‐‑‒–—]*б[\s.\-‐‑‒–—]*а[\s.\-‐‑‒–—]*н[\s.\-‐‑‒–—]*к/i,
        // bank reduced to a lone "Т": "ТОЛЬКО С Т 🟨", "Только Т🟡", "только с Т🟡", "ТОЛЬКО ЖЕЛТЫЙ Т"
        /(только|исключительно|строго)\s+(с\s+|на\s+|из\s+)?(ж[её]лт\S*\s+)?\(?[tт]\)?(?![а-яa-z0-9])/i,
        // "с Т-желтый", "только с Т ЖЕЛТОГО БАНКА" (skipped if the ad also accepts green/Sber)
        /^(?![\s\S]*(зел[её]н|сбер))[\s\S]*(^|[^а-яa-z])[tт][\s\-‐‑‒–—]*ж[её]лт/i,
        // "на желтый т."
        /ж[её]лт\S*\s+\(?т\)?(?![а-яa-z0-9])/i,
        // only "yellow": "только с Жёлтого", "СТРОГО ЖЕЛТОГО СБП", "ТОЛЬКО ЖЕЛТЫЙ"
        // (skipped when the ad also accepts green/Sber: "только с Жёлтого … только со Зелёного")
        /^(?![\s\S]*(зел[её]н|сбер))[\s\S]*(только|исключительно|строго)\s+(с\s+|на\s+|из\s+)?ж[её]лт(ого|ый|ым|ом|ая)/i,
        // "yellow bank" = T-Bank: "с жёлтого (т) банка"
        /ж[её]лт(ого|ый|ом)\s*(\(т\)\s*)?банк/i,
        // Refuses Sber
        /сбербанка? не принимаю|не принимаю платежи от сбербанка|со сбера(, втб, альфа)? не принимаю|кроме сбер|платежи от сбербанка,.*не принимаю/i,
        /международный перевод/i,
        // "scheme" / easy-money spam: "Не Открывай Ордер! Дам свежую схему на +8% за пол часа … @castopnik"
        /(дам|даю|скину|покажу|научу|подскажу|расскажу)\s+(\S+\s+){0,3}(схем|связк|тем[уы])/i,
        /\+\s?\d+([.,]\d+)?\s?%\s*(за|в\s+(день|час|сутки|неделю))/i,
        /не\s+открыва\S*\s+ордер[^.\n]{0,40}(дам|даю|пиши|схем|@)/i,
        /(заработ|доход|профит)\S*[^.\n]{0,30}(\+?\d+\s?%|в\s+день)/i,
        // percentage bonus bait: "+2% ДОПЛАТА", "Доплачу 2% сверху", "бонус +1.5%", "кешбэк 2%"
        /\+\s?\d+([.,]\d+)?\s?%\s*(к\s+)?(доплат|бонус|кэшб[еэ]к|кешб[еэ]к|сверху|к\s+курсу|компенсац)|(доплат\S*|доплачу|бонус|кэшб[еэ]к|кешб[еэ]к)\s*\+?\s?\d+([.,]\d+)?\s?%/i,
        // Cash / Pyypl
        /за наличные|наличный обмен|Pyypl/i,
        // Scheme / "partner" recruiting spam (some written with Latin, Greek or small-caps look-alikes)
        /Cпред до 7.2 пpoцeнтов|пaссuвнo|Веду до результата|Даю рабочую cвязky|Выкуплю Ваши USDT|Свяzkи на ByB|Сοбираю  партнёрοв|пᴀᴘᴛʜᴇ̈ᴘᴏʙ|Ищу партнеров|набираю команду|Актуал тематика/i,
    ];

    // Tested against the remark reduced to Cyrillic letters only (emoji, spaces, dots, dashes removed),
    // which defeats "СТРОГО С 🟡Т-БА НКА" / "Т И Н Ь К О Ф Ф" style obfuscation.
    // Keep these anchored to a leading word: a bare "тбанк" would also hit "от банка", "постбанк".
    const badCompact = [
        // "только с Т банка", "строго с ТБ по СБП", "только с Т по СБП", "только с приложения ТБАНКА"
        /(только|строго|исключительно)(с|из|на)?(приложения)?т(банк|б?(по|через)?сбп)/,
        /тиньк|тинкоф/,
        /желт(ого|ый|ым|ом)т?банк/,
    ];
    const compact = s => toCyrillic(
        s.replace(/🅱️?/gu, 'b')                 // "Т 🅱️ANKA"
         .replace(/(?<=[а-яёa-z])@(?=[а-яёa-z])/gi, 'а') // "Тб@нк"
         .toLowerCase()
         .replace(/[^a-zа-яё]/g, '')                    // keep letters only
         .replace(/b[aа][nн][kк]/g, 'банк')            // Latin/mixed "bank" spelled out → банк
         .replace(/t/g, 'т')                            // "T BANK", "T-банк" with Latin T
    ).replace(/ё/g, 'е').replace(/[^а-я]/g, '');

    // ---------- "mentions T-Bank and doesn't accept Sber" ----------
    // Hides ads that list T-Bank (in any spelling) among the accepted banks unless Sber is also accepted:
    // "Т в а н к, СОВКА, УРАЛ", "С Т или СОВКОМА", "Тбанк, СоВКОМ, УРАЛСИБ, ПСБ", "только 🟡 Банк".
    const SEP = '[\\s.\\-‐‑‒–—]*';
    const tMention = [
        // Т-банк, Т в а н к, Т.ВА.NК, Тбанк, Т-Б А Н К. Not "на Тбанк (моя карта)": that's the seller's card.
        new RegExp(`(^|[^а-яёa-z])(?<!(^|[^а-яё])на\\s{1,3})[tт]${SEP}[бвb]${SEP}[аa]${SEP}[нnhп]${SEP}[кk]`, 'i'),
        /(^|[^а-яёa-z0-9])[tт](?![а-яёa-z0-9])\s*(,|\/|или\b|и\s)/i,     // lone Т in a list: "Т, СОВКА", "С Т или СОВКОМА"
        // "с Т по СБП", "только через Т 🟡", "с 🟡Т !!!" (emoji allowed in between)
        /(^|[^а-яёa-z])(с|из|только|строго|через)[^а-яёa-z0-9]{1,6}[tт](?![а-яёa-z0-9.])/i,
        /(^|[^а-яёa-z])[tт][\s\-‐‑‒–—]+б(?![а-яёa-z])/i,                    // "Т-Б" abbreviation: "в Т-Б.", "с Т-Б"
        /(только|строго|исключительно)\s+(с\s+)?🟡/i,                        // "Строго с 🟡В-Банка"
        /т[иiі][нnп]ь?к[оo0]|tinkoff/i,                                    // Тинькофф, Тiпк0ff
        /ж[её]лт/i,                                                        // "yellow"
        /🟡\s*банк|только\s*🟡/i,
    ];
    const sberMention = [
        /сбер|sber|зел[её]н|(^|[^а-яё])сбе?([^а-яёп]|$)/i,                 // also "Сб"/"Сбе" in "(Т, Ал, Вт, Сб)", "Сбе втб"
        /(^|[^а-яё])с[^а-яёa-z0-9]{0,2}🟢/i,                                 // "С🟢 / Т🟡"
        new RegExp(`[sSсС]${SEP}[bBб6В]${SEP}[eEеЕ]${SEP}[rRрР]`),         // Sbеr, SбЕR, СВЕR, SВ.ЕR (case-sensitive: not "сверху")
    ];
    const sberRefused = /(не\s*принима\S*|кроме)[^.!\n]{0,25}(сбер|зел[её]н)|❌\s*(сбер|зел)|(сбер|зел[её]н)\S*[^.!\n]{0,25}не\s*принима/i;
    const acceptsSber = (text, norm, packed) =>
        (sberMention.some(r => r.test(text) || r.test(norm)) || packed.includes('сбер')) && !sberRefused.test(norm);
    const tBankWithoutSber = (text, norm, packed) =>
        tMention.some(r => r.test(norm)) && !acceptsSber(text, norm, packed);

    const goodFlag = [
        /(Перевод|только) (со )?СБЕР/i,
        /принима\S*\s+(оплату\s+)?(с|из|со)\s+сбер/i,                      // "Принимаю оплату из С6ер6анка" (digits normalized)
        /(^|[^а-яёa-z])с\s+любого\s+банка/i,                               // "С ЛЮБОГО БАНКА"
    ];

    // ---------- default currency (on full page loads only; switching inside the page still works) ----------
    // Covers both direct links (/en/p2p/buy/USDT/EUR) and the bare /en/p2p/ that the site's
    // "P2P" menu link points to (the app would otherwise route that to a geo-based currency).
    const isBuyPage = () => /^\/[^/]+\/p2p\/buy\//.test(location.pathname);
    {
        const m = location.pathname.match(/^\/([^/]+)\/p2p(?:\/buy\/USDT\/([^/]+))?\/?$/);
        if (m && (m[2] || '').toUpperCase() !== DEFAULT_CURRENCY) {
            location.replace(`/${m[1]}/p2p/buy/USDT/${DEFAULT_CURRENCY}` + location.search + location.hash);
            return;
        }
    }

    const root = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const log = (...a) => console.info('[unfuck-bybit]', ...a);

    // ---------- default auto-refresh: the page reads this key on load ----------
    try { root.localStorage.setItem('p2p_auto_refresh_interval', DEFAULT_REFRESH); } catch (_) {}

    // ---------- capture ad data ----------
    // "nickName|price" -> remark. Matching by advertiser + price instead of row index,
    // because Bybit now inserts a "Featured" carousel row into the table.
    const remarks = new Map();
    let listLoads = 0; // number of ad-list responses seen; tells us when the page is interactive
    const keyOf = (nick, price) => `${nick.trim()}|${parseFloat(String(price).replace(/,/g, ''))}`;
    const AD_URL = /\/x-api\/fiat\/otc\/item\/(recommend\/)?online(\?|$)/;

    const originalFetch = root.fetch;
    root.fetch = function (...args) {
        const input = args[0];
        const url = typeof input === 'string' ? input : input?.url || String(input);
        const p = originalFetch.apply(this, args);
        if (AD_URL.test(url)) {
            p.then(r => r.clone().json())
                .then(json => {
                    const items = json?.result?.items || [];
                    for (const it of items) remarks.set(keyOf(it.nickName, it.price), it.remark || '');
                    listLoads++;
                    log(`captured ${items.length} ads from`, url.replace(/^.*\/item\//, 'item/'));
                    scheduleRender();
                })
                .catch(e => log('could not read ads response', e));
        }
        return p;
    };
    root.__unfuckBybit = { remarks, loaded: new Date().toISOString() };
    log('loaded, fetch hooked');

    // ---------- filtering ----------
    // Sellers mix Latin look-alikes into Cyrillic words ("Т-БAНКА" with a Latin A) to dodge filters.
    // Test each regex against both the raw and the Cyrillic-normalized remark.
    const LOOKALIKES = { A:'А', B:'В', C:'С', E:'Е', H:'Н', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У',
                         a:'а', c:'с', e:'е', o:'о', p:'р', x:'х', y:'у', k:'к', m:'м', u:'и', n:'п' };
    const toCyrillic = s => s.replace(/[ABCEHKMOPTXYacepoxykmun]/g, ch => LOOKALIKES[ch]);
    // Digits used as letters inside words: "С6ер6анк" → "Сбербанк", "т0лько" → "только". Prices are untouched.
    // "@" between letters is an "а": "Тб@нк" → "Тбанк" (a "@username" isn't preceded by a letter).
    const deDigit = s => s
        .replace(/(?<=[а-яёa-z])[60]|[60](?=[а-яёa-z])/gi, d => (d === '6' ? 'б' : 'о'))
        .replace(/(?<=[а-яёa-z])@(?=[а-яёa-z])/gi, 'а');
    const matches = (list, text, norm) => list.some(r => r.test(text) || r.test(norm));

    // ---------- exact sum demanded in the remark ----------
    // "ЗАХОДИТЬ СТРОГО на 65к", "Приму 57 350", "СТРОГО НА СУММУ(Ы)❗️ 49110₽", "ЗАХОДИТЕ СТРОГО 96.000₽"
    // A trigger word, then up to 45 chars without digits, then a number (or a list "20 000 / 30 000").
    // List items may carry a currency or a note: "10000р, 15000р", "1413 (СБП), 3087 (СБП)".
    const SUM_ITEM = String.raw`\d[\d\s.,]*(?:\s?(?:к|k|тыс\S*))?`;
    const SUM_SEP = String.raw`\s*(?:р\.?|руб\S*|₽|rub)?\s*(?:\([^)\d]{0,15}\))?\s*(?:,|\/|;|или|и)\s*`;
    const SUM_TRIGGER = new RegExp(String.raw`(заход[^\s\d]*|строго|сумм[аыуеой][^\s\d]*|приму|только\s+на)([^\d+]{0,45}?)(${SUM_ITEM}(?:${SUM_SEP}${SUM_ITEM})*)`, 'gi');
    const NUM = /(\d{1,3}(?:[\s.,]\d{3})+|\d+)(?:[.,]\d{1,2}(?!\d))?(\s?(?:к|k|тыс)(?![а-яёa-z]))?/gi;
    function demandedSums(text) {
        const s = text.replace(/[\u00a0\u202f]/g, ' ');
        const out = [];
        for (const m of s.matchAll(SUM_TRIGGER)) {
            const filler = m[2], after = s.slice(m.index + m[0].length);
            // "от 3000", "до 23:00", "не более 50000": a limit or a time, not an exact sum
            // (emoji/punctuation allowed in between: "строго от ❗3000❗")
            if (/(^|[^а-яё])(от|до|более|менее|макс\S*|мин\S*|лимит\S*|в)[^а-яёa-z0-9]*$/i.test(filler)) continue;
            if (/[а-яёa-z@_]$/i.test(filler)) continue; // part of a word or handle: "сюда:@Tether717\"
            // "суммы кратные 1000", "кратные суммы 1000": multiples, not a sum
            if (/кратн/i.test(filler) || /кратн\S*\s*$/i.test(s.slice(Math.max(0, m.index - 20), m.index))) continue;
            if (/^\s*(:\d|[-–—~]\s*\d|до\s*\d|usdt|\$|€|eur|руб\S*\s+до|мин|час|%|лиц|перевод|раз)/i.test(after)) continue;
            for (const n of m[3].matchAll(NUM)) {
                if (/^\s*[-–—~]\s*\d/.test(s.slice(m.index + m[1].length + m[2].length + n.index + n[0].length))) break; // range "3 000 - 5 000"
                let v = parseInt(n[1].replace(/[\s.,]/g, ''), 10);
                if (n[2]) v *= 1000;
                if (v >= 100 && v <= 10_000_000) out.push(v);
            }
        }
        return [...new Set(out)];
    }

    // ---------- verdict for one ad (pure: bybit.spec.js tests this) ----------
    // limits: [min, max] in RUB as shown in the row, or null if unknown.
    function classify(remark, limits) {
        const norm = deDigit(toCyrillic(remark));
        const packed = compact(remark);
        const sums = demandedSums(remark);
        const outOfRange = !!limits && sums.length > 0 && sums.every(v => v < limits[0] || v > limits[1]);
        const bad = outOfRange
            || matches(badFlag, remark, norm)
            || badCompact.some(r => r.test(packed))
            || tBankWithoutSber(remark, norm, packed);
        const good = !bad && matches(goodFlag, remark, norm);
        return { bad, good, sums, outOfRange };
    }

    // ---------- rendering ----------
    const CSS = `
        .uf-remark { display:block; margin-top:6px; max-width:420px; white-space:pre-wrap;
                     font-size:12px; line-height:1.35; opacity:.85; }
        .uf-sum    { display:block; margin-top:2px; font-size:22px; line-height:28px; font-weight:600; color:#20b26c; } /* same size as the rate (.price-amount) */
        .uf-sum.uf-out { color:#f6465d; }
        #uf-badge  { position:fixed; right:12px; bottom:12px; z-index:99999; padding:6px 10px;
                     border-radius:6px; background:#222; color:#fff; font:12px sans-serif;
                     cursor:pointer; opacity:.85; }
    `;
    function ensureStyle() {
        // Re-added if the page's hydration throws it away.
        if (document.getElementById('uf-style') || !document.head) return;
        const s = document.createElement('style');
        s.id = 'uf-style';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    let showHidden = false;
    let pending = false;
    function scheduleRender() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; render(); });
    }

    function rowKey(tr) {
        const [advTd, priceTd] = tr.children;
        // textContent of leaf nodes (not innerText): innerText loses line structure
        // once the row is display:none, which would make hidden rows "unmatch" and flicker.
        const leaves = [...advTd.querySelectorAll('*')]
            .filter(e => !e.children.length && !e.closest('.uf-remark'))
            .map(e => e.textContent.trim())
            .filter(Boolean);
        const price = (priceTd.textContent.match(/[\d,]+(\.\d+)?/) || [''])[0];
        for (const text of leaves) {
            const k = keyOf(text, price);
            if (remarks.has(k)) return k;
        }
        return null;
    }

    // Inline styles instead of classes: they don't depend on our <style> tag or body classes surviving.
    function paint(tr, bad, good) {
        const bg = bad ? 'rgba(255,0,0,.25)' : good ? 'rgba(0,255,0,.18)' : '';
        const display = bad && HIDE_BAD && !showHidden ? 'none' : '';
        if (tr.style.backgroundColor !== bg) tr.style.backgroundColor = bg;
        if (tr.style.display !== display) tr.style.display = display;
    }

    // The ad's limits as shown in the row: "30,000.00 ~ 88,268.14 RUB".
    function rowLimits(tr) {
        for (const td of [...tr.children].slice(2)) {
            const m = td.textContent.match(/([\d,]+(?:\.\d+)?)\s*~\s*([\d,]+(?:\.\d+)?)/);
            if (m) return [m[1], m[2]].map(x => parseFloat(x.replace(/,/g, '')));
        }
        return null;
    }

    // Shows the demanded sum(s) under the price, red when none of them fits the ad's limits.
    function showSums(tr, sums, out, lim) {
        const priceTd = tr.children[1];
        let el = priceTd.querySelector('.uf-sum');
        if (!sums.length) { el?.remove(); return; }
        if (!el) {
            el = document.createElement('span');
            priceTd.appendChild(el);
        }
        const text = '= ' + sums.map(v => v.toLocaleString('ru-RU')).join(' / ') + ' ₽';
        const cls = 'uf-sum' + (out ? ' uf-out' : '');
        if (el.textContent !== text) el.textContent = text;
        if (el.className !== cls) el.className = cls;
        el.title = out ? `Outside the ad's limits ${lim[0]} ~ ${lim[1]}` : 'Exact sum demanded in the remark';
    }

    function render() {
        ensureStyle();
        let hidden = 0;
        for (const tr of document.querySelectorAll('table tr:not(.new-user-ads-carousel-row)')) {
            if (tr.children.length < 2 || tr.children[0].tagName !== 'TD') continue;
            const k = rowKey(tr);
            const remark = k ? remarks.get(k) : null;
            let el = tr.querySelector('.uf-remark');

            if (remark == null) { el?.remove(); tr.querySelector('.uf-sum')?.remove(); paint(tr, false, false); continue; }
            if (!el) {
                el = document.createElement('span');
                el.className = 'uf-remark';
                tr.children[0].appendChild(el);
            }
            if (el.textContent !== remark) el.textContent = remark; // textContent: never inject seller HTML

            const lim = rowLimits(tr);
            const { bad, good, sums, outOfRange } = classify(remark, lim);
            showSums(tr, sums, outOfRange, lim);
            paint(tr, bad, good);
            if (bad && HIDE_BAD) hidden++;
        }
        updateBadge(hidden);
    }

    function updateBadge(n) {
        let b = document.getElementById('uf-badge');
        if (!b) {
            if (!document.body) return;
            b = document.createElement('div');
            b.id = 'uf-badge';
            b.title = 'Click to show/hide filtered ads';
            b.onclick = () => { showHidden = !showHidden; render(); };
            document.body.appendChild(b);
        }
        const text = `${n} filtered${showHidden ? ' (shown)' : ''}`;
        if (b.textContent !== text) b.textContent = text; // avoid re-triggering the observer
    }

    // ---------- default payment methods: click through the page's own filter UI ----------
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function waitFor(fn, timeout = 20000) {
        for (const end = Date.now() + timeout; Date.now() < end; await sleep(250)) {
            const v = fn();
            if (v) return v;
        }
        return null;
    }
    const filterButton = text => [...document.querySelectorAll('.paywaylist-btn-group button')]
        .find(b => b.textContent.trim() === text);

    const paymentText = () => document.querySelector('.payment-select__values')?.textContent || '';
    const isUnset = () => /All Payment Methods/i.test(paymentText());

    let preselecting = false;
    async function preselectPayments(minLoads) {
        if (preselecting || !isBuyPage()) return;
        preselecting = true;
        try { await doPreselect(minLoads); } finally { preselecting = false; }
    }

    async function doPreselect(minLoads) {
        // The filter is server-rendered before the page becomes interactive; clicks before that
        // are silently lost. An ad-list response for the current view means the app is up.
        await waitFor(() => listLoads >= minLoads, 30000);
        await sleep(500);

        for (let attempt = 1; attempt <= 3; attempt++) {
            if (!document.querySelector('.payment-select__values')) return log('payment filter not found');
            if (!isUnset()) return log('payment filter set:', paymentText());

            // Open the dropdown unless it's already open.
            if (!filterButton('Confirm')?.offsetParent) document.querySelector('.payment-select__values').click();
            const items = await waitFor(() => {
                const lis = [...document.querySelectorAll('li.paywaylist-payment-lists-li')];
                return lis.length && filterButton('Confirm')?.offsetParent ? lis : null;
            }, 5000);
            if (!items) { log(`attempt ${attempt}: payment list did not open`); continue; }

            const picked = [];
            for (const li of items) {
                const name = li.querySelector('.paywaylist-payment-label')?.textContent.trim();
                if (DEFAULT_PAYMENTS.includes(name) && !li.querySelector('input:checked')) {
                    li.querySelector('label')?.click();
                    picked.push(name);
                }
            }
            await sleep(200);
            filterButton('Confirm')?.click();
            await waitFor(() => !isUnset(), 2000);
            log(`attempt ${attempt}: picked`, picked, '→', paymentText());
        }
    }

    function start() {
        ensureStyle();
        new MutationObserver(scheduleRender)
            .observe(document.body, { childList: true, subtree: true, characterData: true });
        scheduleRender();
        preselectPayments(1);

        // The site is a single-page app: moving between P2P views (or from /p2p/ to /p2p/buy/USDT/…)
        // changes the URL without reloading, so re-apply the defaults whenever the path changes.
        let lastPath = location.pathname;
        setInterval(() => {
            if (location.pathname === lastPath) return;
            lastPath = location.pathname;
            log('route changed to', lastPath);
            preselectPayments(listLoads + 1);
        }, 500);
    }
    // Don't rely on DOMContentLoaded: Tampermonkey may inject after it has already fired.
    waitFor(() => document.body, 60000).then(body => body ? start() : log('no <body>, giving up'));
})();
