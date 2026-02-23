const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fs = require('fs');

async function test() {
    try {
        console.log("Fetching...");
        const response = await fetch("https://www.numbeo.com/cost-of-living/in/London");
        const html = await response.text();
        const $ = cheerio.load(html);

        let output = "";
        $('table.data_wide_table tr').each((i, el) => {
            const name = $(el).find('td').eq(0).text().trim();
            const price = $(el).find('td').eq(1).text().trim();
            if (name) {
                output += `[${i}] "${name}" -> "${price}"\n`;
            }
        });

        fs.writeFileSync('scraper_output.txt', output);
        console.log("Written to scraper_output.txt");

    } catch (err) {
        console.error(err);
    }
}

test();
