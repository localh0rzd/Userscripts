// ==UserScript==
// @name         Fuck Blueant
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Nobody should be forced to waste his time like this. Refresh on presence page for the script to work.
// @author       localh0rzd
// @updateURL    https://github.com/localh0rzd/Userscripts/raw/master/blueant.user.js
// @match        https://blueant.optimal-systems.org/blueant/*
// @grant        none
// ==/UserScript==
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
let waitForPresencePageTimeout;
let attempt = 0
let aborted = false
let iframeWindow, iframeDocument
let fromInput, toInput, breakInput, durationInput;

if (window.top === window.self) {
    setTimeout(() => {
        iframeWindow = document.querySelector("iframe").contentWindow
        iframeDocument = document.querySelector("iframe").contentDocument
        waitForPresencePage()
    }, 500)
}

function waitForPresencePage() {
    clearTimeout(waitForPresencePageTimeout)
    console.info(iframeDocument.querySelector("div#presenceContainer"))
    if (iframeDocument && iframeDocument.querySelector("div#presenceContainer")) {
        stuff()
    } else {
        iframeDocument.querySelector("div#presenceContainer")
        console.info("Waiting for presence page")
        if (attempt < 5) {
            waitForPresencePageTimeout = setTimeout(waitForPresencePage, 1000)
            attempt += 1
        }

    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function pickTimes() {
    const arrival = new Date(`1970-01-01T10:00:00`)
    const modifier = new Date(Math.floor(Math.random() * 45) * 60000)
    const toAdd = +new Date() % 2 == 0 ? +modifier : +modifier * -1
    const arrivalFinal = new Date(+arrival + toAdd)
    const departure = new Date(+arrivalFinal + 30600000)
    const departureFinal = new Date(+departure + (getRandomInt(-10, 15) * 60000))
    const workTime = new Date(+departureFinal - +arrivalFinal - 1800000)

    return {
        arrival: `${arrivalFinal.getHours().toString().padStart(2, "0")}:${arrivalFinal.getMinutes().toString().padStart(2, "0")}`,
        departure: `${departureFinal.getHours().toString().padStart(2, "0")}:${departureFinal.getMinutes().toString().padStart(2, "0")}`,
        time: `${(workTime.getHours() - 1).toString().padStart(2, "0")}:${workTime.getMinutes().toString().padStart(2, "0")}`
    }
}

function stuff() {
    const bangnav = document.querySelector("div[data-qs-name='nav'] ul")
    const startButton = document.createElement("button")
    const goToBeginningButton = document.createElement("button")
    const stopButton = document.createElement("button")
    const eingabeInput = iframeDocument.querySelector("td.eingabe")
    const callback = iframeWindow.ajaxEventCallbackWithWaitLogo

    let fromInputValue, toInputValue, breakInputValue;
    const eventCallbackWithDebounce = (a, b, c, d) => {
        // We need to reset the values, because some funky scripting in the background resets them unconditionally
        if (fromInputValue || fromInputValue == "") {
            fromInput.value = fromInputValue
        }
        if (toInputValue || toInputValue == "") {
            toInput.value = toInputValue
        }
        if (breakInputValue || breakInputValue == "") {
            breakInput.value = breakInputValue
        }
        callback(a, b, c, d)
    }
    iframeWindow.ajaxEventCallbackWithWaitLogo = eventCallbackWithDebounce

    startButton.innerHTML = "Autocomplete"
    goToBeginningButton.innerHTML = "Jump to October 2017"
    stopButton.innerHTML = "HALT STOPP"

    async function processWeek(weekDate, dateData) {
        if(aborted) {
            return
        }
        if (weekDate) {
            iframeWindow.ajax_showWeekWt(+weekDate, '1', '1337')
            await wait(500)
        } else if (dateData) {
            iframeWindow.ajax_showWeekWt(dateData, '1', '1337')
            await wait(500)
        }
        const relevantMonthDays = iframeDocument.querySelectorAll("td.cm_day:not(.cm_weekend):not(.cm_outside):not(.genehmigt):not(.genehmigtcalendarcurrent):not(.cm_kw_finished):not(.cm_weekend_outside):not(.worktimebg)")
        for (const day of relevantMonthDays) {
            const buttons = iframeDocument.querySelectorAll("button")
            let link = day.querySelector("a").href
            let dateData = link.match(/'(.*?)'/gi).map(x => x.replace(/'/g, ""))
            if (dateData[0] > +new Date()) {
                console.info("for(): Won't add attendance for the future, exiting")
                return;
            }
            const evt = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: iframeWindow
            });
            iframeWindow.ajax_showWeekWt(dateData[0], dateData[1], dateData[2])
            iframeWindow.ajax_setDefaultWorktimeStartValue(dateData[3], dateData[4], dateData[5])
            await wait(800)
            fromInput = iframeDocument.querySelector("input[name=from_time]")
            toInput = iframeDocument.querySelector("input[name=to_time]")
            breakInput = iframeDocument.querySelector("input[name=break]")
            durationInput = iframeDocument.querySelector("input[name=dauer]")

            const times = pickTimes()
            fromInput.value = times.arrival
            fromInputValue = times.arrival
            fromInput.focus()
            await wait(800)
            try {
                iframeDocument.querySelector("button.ui-datepicker-close").click()
            } catch (e) {}
            await wait(800)
            toInput.value = times.departure
            toInputValue = times.departure
            toInput.focus()
            await wait(800)
            try {
                iframeDocument.querySelector("button.ui-datepicker-close").click()
            } catch (e) {}
            await wait(800)

            breakInput.value = "00:30"
            breakInputValue = "00:30"
            breakInput.focus()
            await wait(800)
            try {
                iframeDocument.querySelector("button.ui-datepicker-close").click()
            } catch (e) {}
            await wait(500)
            //debugger
            fromInput.dispatchEvent(new Event("change"))
            toInput.dispatchEvent(new Event("change"))
            breakInput.dispatchEvent(new Event("change"))
            if (aborted) {
                return
            }
            buttons[0].click()
            await wait(750)

            iframeDocument.querySelectorAll("div.listbox-wrapper")[1].click()
            const dropdownElements = iframeDocument.querySelectorAll("li.list-option.active")
            dropdownElements[dropdownElements.length - 1].click()

            durationInput.value = times.time
            durationInput.dispatchEvent(new Event("change"))
            if (aborted) {
                return
            }
            buttons[1].click()

            await wait(750)
            fromInputValue = null
            toInputValue = null
            breakInputValue = null
        }
        iframeDocument.querySelector("td.cm_right_buttons > div > div > a").click()
        await wait(750)
        processWeek()
        /*
        if (!weekDate || relevantMonthDays.length == 0) {
            const outsideDays = iframeDocument.querySelectorAll("td.cm_outside  > div:not(.hint) > a, td.cm_weekend_outside > div:not(.hint) > a")
            const lastOutsideDay = outsideDays[outsideDays.length - 1]
            let dateData = lastOutsideDay.href.match(/'(.*?)'/gi).map(x => x.replace(/'/g, ""))
            processWeek(null, dateData[0])
        } else {
            const lastYear = weekDate.getFullYear()
            const lastMonth = weekDate.getMonth() + 1
            if (+new Date() < +weekDate) {
                console.info("Won't add attendance for the future, exiting")
            } else if (lastMonth == 12) {
                processWeek(new Date(`${+lastYear + 1}-01-01T00:00:00`))
            } else {
                processWeek(new Date(`${lastYear}-${(+lastMonth + 1).toString().padStart(2, "0")}-01T00:00:00`))
            }

        }
        */
    }
    startButton.addEventListener("click", e => {
        aborted = false
        processWeek()
    })

    goToBeginningButton.addEventListener("click", e => {
        iframeWindow.ajax_showWeekWt(+new Date(`2017-10-01T00:00:00`), '1', '1337')
    })
    stopButton.addEventListener("click", e => {
        aborted = true
        setTimeout(() => {
            fromInputValue = null
            toInputValue = null
            breakInputValue = null
        }, 2500)
    })
    const li1 = document.createElement("li")
    const li2 = document.createElement("li")
    const li3 = document.createElement("li")
    li1.appendChild(startButton)
    li2.appendChild(goToBeginningButton)
    li3.appendChild(stopButton)

    bangnav.appendChild(li1)
    bangnav.appendChild(li2)
    bangnav.appendChild(li3)
}