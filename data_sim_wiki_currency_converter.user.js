// ==UserScript==
// @name        Auto currency converter
// @namespace   aaaaaaa
// @include     http://prepaid-data-sim-card.wikia.com/wiki/*
// @version     4
// @grant       GM_xmlhttpRequest
// @connect     www.floatrates.com
// @noframes
// ==/UserScript==

var baseCurrency = 'EUR';

var numberRegex = '[-+]?\\.?\\d([.,0-9]*\\d)?';
var partSeparatorRegex = '(,\\s*|\\s*-\\s*|\\s+or\\s+|\\s+and\\s+|\\s+and/or\\s+|\\s+to\\s+)';

function guessCountryDollar() {
    var articleMap = {
        "Australia": "AUD",
        "Barbados": "BBD",
        "Cambodia": "USD",
        "Canada": "CAD",
        "Ecuador": "USD",
        "El_Salvador": "USD",
        "Marshall_Islands": "USD",
        "Micronesia": "USD",
        "New_Zealand": "NZD",
        "Timor-Leste": "USD",
        "Zimbabwe": "USD"
    }

    var articleName = window.location.href.slice(window.location.href.lastIndexOf("/") + 1);

    if (articleName.indexOf("USA") != -1 || articleName.indexOf("United_States") != -1) {
        return "USD";
    } else if (articleMap[articleName]) {
        return articleMap[articleName];
    }

    return false;
}
function buildRegex(currencyCodes) {
    var code =
        // Price lists/ranges (e.g. '5-10 PLN', '5 or 10 PLN' or '5, 10 and 20 PLN'
        '(' + numberRegex + partSeparatorRegex + ')*' +
        // Last part of price ranges and/or individual prices
        numberRegex;

    return {
        'prefix': new RegExp('[^a-z](' + currencyCodes.join("|") + ')\\s*' + code, 'gi'),
        'postfix': new RegExp(code + '\\s*(' + currencyCodes.join("|") + ')[^a-z]', 'gi')
    };
}
function getConversionCourses() {
    return new Promise(function (resolve, reject) {
        try {
            var cache = sessionStorage.getItem("_gm_currency_exchange_rates");
            if (cache) {
                cache = JSON.parse(cache);
                if (cache && cache.time && cache.time > (new Date).getTime() - 3600000) {
                    resolve(cache.courses);
                    return;
                }
            }
        } catch (e) {
            console.error(e);
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'http://www.floatrates.com/daily/' + baseCurrency + '.json',
            onload: function (response) {
                var courses = JSON.parse(response.responseText);
                sessionStorage.setItem("_gm_currency_exchange_rates", JSON.stringify({
                    time: (new Date).getTime(),
                    courses: courses
                }));
                resolve(courses);
            },
            onerror: function (res) {
                reject(res);
            }
        });
    });
}
window.addEventListener('load', function (a) {
    getConversionCourses().then(function (courses) {
        try {
            var contentElement = document.getElementById("WikiaArticle");
            var currCodes = Object.keys(courses);
            var content = contentElement.innerHTML;
            var regex = buildRegex(currCodes);

            var replacePrice = function (mode) {
                return function (price) {
                    if (mode == "prefix") {
                        var originalPrice = price.slice(1);
                        var currency = price.slice(1, 4);
                        var priceParts = price.slice(4);
                    } else {
                        var originalPrice = price.slice(0, -1);
                        var currency = price.slice(-4, -1);
                        var priceParts = price.slice(0, -4);
                    }
                    if (currency == baseCurrency || !courses[currency.toLowerCase()]) {
                        return price;
                    }

                    priceParts = priceParts.trim().split(new RegExp(partSeparatorRegex, 'gi'));
                    replacement = "";
                    for (let part of priceParts) {
                        if (part.trim().match(new RegExp('^' + numberRegex + '$', 'gi'))) {
                            let amount = parseFloat(part.trim().replace(/[,+]/g, ""));
                            convertedAmount = amount / courses[currency.toLowerCase()].rate;
                            replacement +=
                                "<strong>" +
                                (convertedAmount < 0.1 ? parseFloat(convertedAmount).toFixed(3) : parseFloat(convertedAmount).toFixed(2)) +
                                "</strong>";
                        } else {
                            replacement += part;
                        }
                    }
                    replacement += " <strong>" + baseCurrency + "</strong> <small style='opacity:0.6'>(" + originalPrice.replace(/\s+/, " ").trim() + ")</small>";

                    if (mode == "prefix") {
                        replacement = price.slice(0, 1) + replacement;
                    } else {
                        replacement += price.slice(-1);
                    }

                    return replacement;
                }
            };

            // element.innerHTML replaces non-breaking spaces with '&nbsp;' which \s would not match
            content = content.replace(/&nbsp;/g, String.fromCharCode(160));

            // Replace things like 'HK$' or 'CA$' into actual currency codes ('HKD' and 'CAD' respectively)
            content = content.replace(/([^a-z][a-z]{2})\$([^a-z])/gi, "$1D$2");

            // Signapore 'S$' → 'SGD'
            content = content.replace(/([^a-z])S\$([^a-z])/gi, "$1SGD$2");

            // Brunei 'B$' → 'BND'
            content = content.replace(/([^a-z])B\$([^a-z])/gi, "$1BND$2");

            // Taiwan 'NTD' → 'TWD'
            content = content.replace(/([^a-z])NTD([^a-z])/gi, "$1TWD$2");

            // China 'RMB' => 'CNY'
            content = content.replace(/([^a-z])RMB([^a-z])/gi, "$1CNY$2");

            // Turkey 'TR' => 'TRY'
            content = content.replace(/([^a-z<])TR([^a-z>])/gi, "$1TRY$2");

            // Replace currency symbols
            content = content.replace(/€/g, "EUR");
            content = content.replace(/£/g, "GBP");
            content = content.replace(/¥/g, "JPY");

            // Try to convert individual '$' signs in the local currency if we can figure that out
            if (guessCountryDollar()) {
                content = content.replace(/([^a-z])\$(\s*[.,0-9]+)/g, "$1" + guessCountryDollar() + "$2");
            }

            content = content.replace(regex.postfix, replacePrice("postfix"));
            content = content.replace(regex.prefix, replacePrice("prefix"));

            contentElement.innerHTML = content;
        } catch (e) {
            console.error(e);
        }
    }, function (err) {
        console.info(err);
    });
});
