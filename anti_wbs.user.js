// ==UserScript==
// @name        Anti WBS
// @namespace   https://github.com/localh0rzd/Userscripts/
// @description Filtert WBS und schlechte Anbieter heraus
// @include     http*://*immowelt.de/liste/*
// @include     http*://*immobilienscout24.de/Suche/*
// @include     http*://*immonet.de/immobiliensuche/*
// @updateURL   https://github.com/localh0rzd/Userscripts/raw/master/anti_wbs.user.js
// @version     1.5
// @grant       GM_xmlhttpRequest
// ==/UserScript==

var badDistricts = ["Adlershof",
"Altglienicke",
"Buch",
"Buckow",
"Friedrigshagen",
"Gropiusstadt",
"Hellersdorf",
"schönhausen",
"Johannisthal",
"Karlshorst",
"Karow",
"Köpenick",
"Lichtenberg",
"Lichtenrade",
"Mariendorf",
"Marienfelde",
"Marzahn",
"Pankow",
"Reinickendorf",
"Rudow",
"^(?!Spandauer).*Spandau",
"Tegel",
"Treptow",
"Wilhelmsruh"];
var averageDistricts = ["Friedrichshain",
"Mitte",
"Neukölln",
"Prenzlauer Berg",
"Steglitz",
"Weißensee",
"Zehlendorf"];
var goodDistricts = ["Charlottenburg",
"Kreuzberg",
"Mitte",
"Moabit",
"Schöneberg",
"Tempelhof",
"Tiergarten",
"Wedding",
"Wilmersdorf"];
function filter(site) {

    var query;
    if (site === "immoscout") {
        query = '.result-list-entry__brand-title-container';
    } else if (site === "immowelt") {
        query = '.listitem a';
    } else if (site === "immonet") {
        query = ".box-40 a[id^='lnkImgToDetails']";
    }
    for (let a of document.querySelectorAll(query)) {
        try{
        var addressLine = a.parentNode.querySelector('div.result-list-entry__address > a').innerHTML;
        var rent = a.parentNode.querySelector("div > div.result-list-entry__criteria.margin-bottom-s > div > div.grid.grid-flex.gutter-horizontal-l.gutter-vertical-s > dl:nth-child(1) > dd").innerHTML;
        var room = a.parentNode.querySelector("div > div.result-list-entry__criteria.margin-bottom-s > div > div.grid.grid-flex.gutter-horizontal-l.gutter-vertical-s > dl:nth-child(2) > dd").innerHTML;
        
        var rent = Number(rent.replace(/[^0-9,]+/g, "").replace(/,/, "."));
        var room = Number(room.replace(/[^0-9,]+/g, "").replace(/,/, "."));
        var cost = (rent / room).toFixed(2);
        console.info(cost);

        var gutter = a.parentNode.querySelector('.result-list-entry__brand-title-container').parentNode.querySelector("div > div.result-list-entry__criteria.margin-bottom-s > div > div.grid.grid-flex.gutter-horizontal-l.gutter-vertical-s");
        if(!gutter.querySelector('.kurwa')){
        var tempchild = document.createElement("dl");
        //tempchild.innerHTML = '<dl class="grid-item result-list-entry__primary-criterion " role="presentation"><dd class="font-nowrap font-line-xs">536,54 €</dd><dt class="font-s onlyLarge">Kaltmiete</dt></dl>'
        tempchild.classList.add("grid-item", "result-list-entry__primary-criterion", "kurwa");
        tempchild.innerHTML = `<dd class="font-nowrap font-line-xs">${cost.toString().replace(/\./, ",")}</dd><dt class="font-s onlyLarge">€ / m²</dt>`;
        gutter.appendChild(tempchild);

        }
        
        var elem = a.parentNode.parentNode.parentNode.parentNode;
        //addExtraText(elem, ''.concat(res.substring(res.indexOf(match) - 30, res.indexOf(match))).concat('<span style="color: red;">').concat(res.substring(res.indexOf(match), res.indexOf(match) + match.length)).concat('</span>').concat(res.substring(res.indexOf(match) + match.length, res.indexOf(match) + 30)), 'wbs');


        var goodDistrictRegex = new RegExp(goodDistricts.join("|"), 'gi');
        var averageDistrictRegex = new RegExp(averageDistricts.join("|"), 'gi');
        var badDistrictRegex = new RegExp(badDistricts.join("|"), 'gi');
        if (goodDistrictRegex.test(addressLine) && site === "immoscout") {
            var elem = a.parentNode.parentNode.parentNode.parentNode;
            elem.style.backgroundColor = 'rgba(0,255,0,0.4)';
        }
        if (averageDistrictRegex.test(addressLine) && site === "immoscout") {
            var elem = a.parentNode.parentNode.parentNode.parentNode;
            elem.style.backgroundColor = 'rgba(255,165,0,0.4)';
        }
        if (badDistrictRegex.test(addressLine) && site === "immoscout") {
            var elem = a.parentNode.parentNode.parentNode.parentNode;
            elem.style.backgroundColor = 'rgba(255,0,0,0.4)';
        }

        if (!(site === "immowelt" && !a.href.match(/\/expose\//gi))) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: a.href,
                onload: function(response) {
                    var res = response.responseText.replace(/<(script.*?|style.*?)>[\s\S]*?<\/(script|style)>|<[\s\S]*?>|&.*?;/gmi, "");

                    if (site === "immowelt") {
                        var elem = a.parentNode;
                        if(res.indexOf("frei ab") !== -1){
                            addExtraText(elem, ''.concat(res.substring(res.indexOf("frei ab"), res.indexOf("frei ab") + 30)), 'free');
                        }

                    } else if (site === "immoscout") {
                        var elem = a.parentNode.parentNode.parentNode.parentNode;
                        if(res.indexOf("Bezugsfrei ab") !== -1){
                            addExtraText(elem, ''.concat(res.substring(res.indexOf("Bezugsfrei ab"), res.indexOf("Bezugsfrei ab") + 30)), 'free');
                        }
                    } else if (site === "immonet") {
                        var elem = a.parentNode.parentNode.parentNode;
                    }
                    var re = /(WBS|Wohnberechtigungsschein|Deutsche Wohnen|Gewobag)/gi;

                    res.replace(re, function(match, g1, g2) {
                        setOpacity(elem);
                        addExtraText(elem, ''.concat(res.substring(res.indexOf(match) - 30, res.indexOf(match))).concat('<span style="color: red;">').concat(res.substring(res.indexOf(match), res.indexOf(match) + match.length)).concat('</span>').concat(res.substring(res.indexOf(match) + match.length, res.indexOf(match) + 30)), 'wbs');
                    }
                    );
},
onerror: function(res) {}
});
        }
    }catch(err){console.warn(err);}
}
}

function work() {
    setTimeout(function() {
        if (window.location.toString().match(/immowelt.de/)) {
            filter("immowelt");
        }
        if (window.location.toString().match(/immobilienscout24.de/)) {
            filter("immoscout");
        }
        if (window.location.toString().match(/immonet.de/)) {
            filter("immonet");
        }
    }, 1000);
}

function setOpacity(elem){
    elem.style.opacity = '0.3';
    elem.style.transition = "opacity 0.5s";
    //elem.style.transform = "scale(0.5,0.5)";
    elem.onmouseover = function() {
        this.style.opacity = 0.6;
    };
    elem.onmouseout = function() {
        this.style.opacity = 0.4;
    };
}

function addExtraText(elem, text, kind){
    if(typeof elem.altered === "undefined"){
        elem.altered = [];
    }
    if(elem.altered.indexOf(kind) > -1){
        return;
    }
    elem.altered.push(kind);
    var subtext = document.createElement("h5");
    subtext.innerHTML = text;
    elem.parentNode.appendChild(subtext);
}
document.addEventListener("click", work);
window.addEventListener("popstate", work);
work();