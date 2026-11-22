// Tests for the ad filters in bybit.user.js. Run with:  node --test bybit.spec.js
// No dependencies: uses Node's built-in test runner.
//
// The userscript isn't a module, so this loads its two pure sections by their section markers
// (config + the regex lists, and "filtering" through the "verdict" block) and runs them in isolation.
// If you rename a "// ---------- … ----------" marker, update the slices below.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'bybit.user.js'), 'utf8');
const between = (from, to) => {
    const i = src.indexOf(from), j = src.indexOf(to, i);
    assert.ok(i >= 0 && j > i, `section markers not found: "${from}" … "${to}"`);
    return src.slice(i, j);
};
const { classify, demandedSums } = new Function(
    between('    // ---------- config ----------', '    // ---------- default currency') +
    between('    // ---------- filtering ----------', '    // ---------- rendering ----------') +
    '\nreturn { classify, demandedSums };',
)();

const verdict = (remark, limits = null) => {
    const v = classify(remark, limits);
    return v.bad ? 'bad' : v.good ? 'good' : 'neutral';
};

// ---------- exact sum demanded in the remark ----------
const sumCases = [
    // the examples this feature was built from
    ['Заходить только на суммы указанную ниже !!!\nПО СБП:-20000', [20000]],
    ['ЗАХОДИТЬ СТРОГО на  65к ', [65000]],
    ['Приму   57 350 ', [57350]],
    ['🟢ЗАХОДИТЬ НА СУММУ:  30000', [30000]],
    ['❗️СТРОГО НА СУММУ(Ы)❗️ 49110₽ ', [49110]],
    ['✅СТРОГО НА СУММУ:    2150 RUB  ⛔️', [2150]],
    ['Перевод только от  лица. ЗАХОДИТЕ СТРОГО . ЗАХОДИТЕ СТРОГО 96.000₽.', [96000]],
    // formats and lists
    ['СТРОГО НА СУММЫ: 20 000 / 30 000', [20000, 30000]],
    ['ТОЛЬКО НА СУММУ      22.150 / 40к /  15к', [22150, 40000, 15000]],
    ['Строго на 49 110,00 руб', [49110]],
    ['Заходить на суммы: 1413 (СБП), 3087 (СБП)', [1413, 3087]],
    ['ЗАХОДИТЕ НА 10000р, 15000р /// принимаю', [10000, 15000]],
    ['ЗАХОДИТЬ СТРОГО НА: 10000. 15000.20000.', [10000, 15000, 20000]],
    ['ЗАХОДИТЬ НА 10000,20000 на кратные до 50000', [10000, 20000]],
    ['Заходите на сумму 25500р', [25500]],
    ['ТОЛЬКО СУММЫ❗45000❗ Оплата на карту', [45000]],
    ['СУММЫ:500', [500]],
    ['заходить:5000р', [5000]],
    ['с любого банка! только от первых лиц! СТРОГО НА 55т', [55000]],
    ['Строго на 30т / 40т.', [30000, 40000]],
    ['СТРОГО НА 5000 т-банк не принимаю', [5000]],
    ['СТРОГО НА 5000 т банк', [5000]],
    ['ЗАХОДИТЬ НА 20620 . ', [20620]],
    ['ЗАХОДИТЬ НА 20620 . Перевод со сбер', [20620]],
    ['ЗАХОДИТЬ НА 20620 . перевод только от 1 лица', [20620]],
    ['Заходить строго на 3 перевода', []],
    // bare two-digit numbers are thousands
    ['ЗАХОДИТЬ НА 55 и 23.', [55000, 23000]],
    ['Строго на 40', [40000]],
    ['Приму 15/20/25', [15000, 20000, 25000]],
    ['по сбп только от 1 лиц ! на суммы 20/30/40/и тд', [20000, 30000, 40000]],
    // not an exact sum
    ['Строго 15 минут на оплату', []],
    ['Строго на 55р', []],
    ['строго 1 платежом', []],
    ['на любые суммы (ТГ в чат). оперативно отвечаю и работаю 24/7.', []],
    ['Строго на 24/7', []],
    ['Заходить строго до 23:00', []],
    ['строго от 2 лиц', []],
    ['Строго от 5000 до 10000', []],
    ['Заходите на сумму от 3000', []],
    ['ЗАХОДИТЬ от 3 000 - 5 000', []],
    ['Только на 5000-10000', []],
    ['Суммы: 8000–21000', []],
    ['Строго 1 платежом, оплата в течение 15 минут', []],
    ['строго по номеру +79991234567', []],
    ['С ЛЮБОГО БАНКА', []],
    ['❗Заходить строго от ❗3000❗на кратные суммы равные 3000 4000 5000 и тд', []],
    // multiples of an amount
    ['Заходить Строго на суммы кратные 1000₽', []],
    ['ЗАХОДИТЬ СТРОГО НА: Любую сумму кратную 1.000р', []],
    ['Сумма ордера должна быть кратной 1000', []],
    ['Суммы: 8000–21000 ₽ Только кратные суммы 1000!', []],
    // Telegram handles ending in digits
    ['заходить на суммы кратные 1000 (могу принять другие суммы уточнять в лс писать сюда:@Tether717)', []],
    ['1и3 лицо тоже приму для сотрудничества мой тг:@mememem90877', []],
];

for (const [remark, want] of sumCases) {
    test(`sums: ${remark.replace(/\n/g, '\\n').slice(0, 70)}`, () => {
        assert.deepEqual(demandedSums(remark), want);
    });
}

// ---------- good / bad verdicts ----------
const verdictCases = [
    // [remark, limits [min, max] or null, expected]
    ['Перевод со СБЕР', null, 'good'],
    ['С ЛЮБОГО БАНКА', null, 'good'],
    ['Оплата с любого банка, чек на почту', null, 'good'],
    ['Весь любого банка', null, 'neutral'],
    ['Перевод зарубеж в таджикистан', null, 'bad'],
    ['перевод  зарубежный', null, 'bad'],
    ['Перевод будет зарубеж в таджикистан', null, 'bad'],
    ['Переводы за рубеж', null, 'bad'],
    ['Перевод со СБЕР, получатель в Узбекистане', null, 'bad'],
    ['Казахстан', null, 'bad'],
    ['Перевод на карту Kыргызстана', null, 'bad'],                 // Latin K
    ['Перевод со СБЕР в Киргизию', null, 'bad'],
    ['Кыргызстан', null, 'bad'],
    ['туркменский банк', null, 'bad'],
    ['Перевод со СБЕР, из-за рубежа не принимаю', null, 'good'],
    ['Оплата с Тб@нк с официальным чеком от банка на почту', null, 'bad'],
    ['Оплата с Т-б@нка', null, 'bad'],
    ['Чек на почту от официальной почты ТИНЬ', null, 'bad'],
    ['Только тинь', null, 'bad'],
    ['С ЛЮБОГО БАНКА, кроме Тб@нк', null, 'bad'],
    ['2️⃣ 🏦 Принимаю оплату с любого банка, кроме зелёного банка на букву «С»', null, 'bad'],
    ['С любого банка, кроме Сбербанка', null, 'bad'],
    ['С любого банка, кроме ВТБ и Сбера', null, 'bad'],
    ['С любого банка, кроме ВТБ. Сбер приветствуется', null, 'good'],
    ['пишите @castopnik', null, 'neutral'],
    // demanded sum vs the ad's limits
    ['Перевод только от  лица. ЗАХОДИТЕ СТРОГО . ЗАХОДИТЕ СТРОГО 96.000₽.', [30000, 88268.14], 'bad'],
    ['Приму   57 350 ', [30000, 42000], 'bad'],
    ['Заходить строго на 610р', [500, 552.35], 'bad'],
    ['Приму/ 9500', [10000, 91000], 'bad'],
    ['ЗАХОДИТЬ СТРОГО НА 24 000 РУБ', [5000, 24000], 'neutral'],   // max is inclusive
    ['ЗАХОДИТЬ СТРОГО НА СУММУ 5500', [5000, 5500], 'neutral'],
    ['СТРОГО НА СУММЫ: 20 000 / 30 000', [25000, 50000], 'neutral'], // one of them fits
    ['ЗАХОДИТЕ НА 10000р, 15000р', [5000, 5742.44], 'bad'],          // none fits
    ['Приму   57 350 ', null, 'neutral'],                              // limits unknown: don't guess
    ['Заходить Строго на суммы кратные 1000₽', [10000, 30000], 'neutral'],
    ['писать сюда:@Tether717', [10000, 14876.56], 'neutral'],
    ['Перевод со СБЕР, заходить на 99000', [1000, 50000], 'bad'],
    ['ЗАХОДИТЬ НА 55 и 23.', [20000, 54000], 'neutral'],               // 23 000 fits
    ['ЗАХОДИТЬ НА 55 и 23.', [30000, 54000], 'bad'],      // out of range beats good
    // upper limit below MIN_CEILING (5000 RUB)
    ['Перевод со СБЕР', [500, 4999.99], 'bad'],
    ['Перевод со СБЕР', [500, 5000], 'good'],                          // exactly 5000 is kept
    ['', [1000, 2095], 'bad'],                                         // no remark at all
    ['', [1000, 300000], 'neutral'],
];

for (const [remark, limits, want] of verdictCases) {
    test(`verdict ${want}: ${remark.slice(0, 60)}${limits ? ` [${limits.join(' ~ ')}]` : ''}`, () => {
        assert.equal(verdict(remark, limits), want);
    });
}

// ---------- "на всю сумму": the ad's upper limit, without cents ----------
const wholeCases = [
    // [remark, limits, expected sums]
    ['СТРОГО НА ВСЮ СУММУ', [30000, 88268.14], [88268]],
    ['заходить строго на всю сумму ордера', [5000, 12000], [12000]],
    ['Вся сумма одним платежом', [10000, 25000.99], [25000]],
    ['СТРОГО НА ВСЮ СУММУ', null, []],                       // limits unknown
    ['Всюду сумму не пишу', [5000, 12000], []],
    // a fixed sum or a range narrower than 1000 ₽: its upper limit
    ['', [32735, 32735], [32735]],
    ['Перевод со СБЕР', [32000, 32735.5], [32735]],
    ['Перевод со СБЕР', [31735, 32735], []],                  // exactly 1000 wide: a real range
    ['Перевод со СБЕР', [10000, 50000], []],
    ['Приму 32 200', [32000, 32735], [32200]],                // the remark's own sum wins
];

for (const [remark, limits, want] of wholeCases) {
    test(`whole sum: ${remark}${limits ? ` [${limits.join(' ~ ')}]` : ''}`, () => {
        const v = classify(remark, limits);
        assert.deepEqual(v.sums, want);
        assert.equal(v.outOfRange, false);
    });
}
