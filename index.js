const puppeteer = require("puppeteer");
const config = require("config");
const sleep = require("sleepjs");
const fs = require("fs");
options = config.get("puppeteer_options");
args = config.get("browser_args");
const readline = require('readline-sync');

const name = readline.question("Ingresa el nombre a buscar:");
const location = readline.question("Ingresa la locación a buscar:");

if (!name) {
    console.log("Por favor ingresa un nombre.")
    return;
}
fileName = check_file(`${location}_${name}`)
const maxPages = process.argv[3] || 1;

function Xls() {
    let count = 0;
    let sheetCount = 1;
    const XLSX = require('xlsx');
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet([["Nombre", "Dirección", "Telefono"]]);
    XLSX.utils.book_append_sheet(wb, ws, "sheet11");
    let isFirst = true;
    this.save = (data) => {
        console.log(data);
        XLSX.utils.sheet_add_json(ws, data, { skipHeader: true, origin: isFirst ? "A2" : -1 });
        XLSX.writeFile(wb, fileName);
        isFirst = false;
    }
}


function check_file(fileName) {
    if (fileName) {
        fileName = fileName.replace(/(\.xlsx)?$/i, ".xlsx");
        if (fs.existsSync(fileName)) {
            console.log("El archivo existe, por favor elegir otro nombre!")
            process.exit(code = 0)
        }
    } else {
        console.log("Por favor ingresa un nombre!");
        process.exit(code = 0)
    }
    return fileName;
}


(async () => {
   
    const xls = new Xls();
    const paginasblancas_browser = await new Paginasblancas_browser();

    await paginasblancas_browser.search(name);



    function Paginasblancas_browser() {
        let browser;
        let pages = [];
        this.search = async (name) => {
            const page_free = pages.find(p => p.free);
            let pageResultGenerator;
            if (page_free) {
                pageResultGenerator = await page_free.search(name);
            } else {
                const page_new = await new Paginasblancas(browser);
                pages.push(page_new);
                pageResultGenerator = await page_new.search(name);
            }
            process(pageResultGenerator)
        }
        this.throttle = async () => {
            let isMax = true;
            while (isMax) {
                isMax = pages.length >= maxPages && pages.filter(p => p.free).length === 0;
                await sleep(1000)
            }
        }
        let process = async (pageResultGenerator) => {
            const gen = await pageResultGenerator();
            async function handle(yield) {
                if (!yield.done) {
                    const result = yield.value
                    xls.save(result.data);
                    console.log(`${result["name"]} page ${result["number"]} saved`);

                    await handle(await gen.next())
                }
            }
            await handle(await gen.next())
        }
        return (async () => {
            browser = await puppeteer.launch({ ...options, headless: true });
            return this;
        })()
    }
    function Paginasblancas(browser) {
        this.free = false;
        let page;
        let init = async () => {
            const url = "http://www.paginasblancas.pe";
            page = await browser.newPage();
            await page.goto(url, { waitUntil: "networkidle2" });
            await page.waitForFunction(() => typeof jQuery != "undefined");
        }
        let getData = async () => await page.evaluate(() => jQuery("ul.m-results-businesses >li").map((i, row) => ({
            name: jQuery(row).find(".m-results-business--name").text().trim(),
            address: jQuery(row).find(".m-results-business--address").text().trim().replace(/\s+/g, " "),
            phone: jQuery(row).find(".m-icon--single-phone").text().trim().replace(/\s+/g, ""),

        })).get()
        )
        this.search = async (name) => {
            this.free = false;
            await page.waitForSelector("#nName");
            await page.waitForSelector("#btnSrchName");
            await page.click("#nName", { clickCount: 3 });
            await page.type("#nName", name);
            if (location) {
                await page.click("#nLocality", { clickCount: 3 });
                await page.type("#nLocality", location);
            }
            page.click("#btnSrchName")
            await page.waitForNavigation({ timeout: 90000 });
            await page.waitForFunction(() => typeof jQuery != "undefined");
            const baseUrl = page.url().replace(/\/p\-\d+$/, "");
            let hasNext = await page.evaluate(() => jQuery("ul.m-results-pagination > li.last").length);
            let number = 1;
            const that = this;
            return async function* () {
                yield ({ data: await getData(), number, name });
                while (hasNext) {
                    await page.goto(`${baseUrl}/p-${++number}`)
                    await page.waitForFunction(() => typeof jQuery != "undefined");
                    yield ({ data: await getData(), number, name });
                    hasNext = await page.evaluate(() => jQuery("ul.m-results-pagination > li.last").length);
                }
                that.free = true;
            }

        }
        return (async () => {
            await init();
            return this;
        })()
    }



    
})()
