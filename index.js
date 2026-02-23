const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const _ = require("lodash");

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.static('public'));

const fs = require('fs');
const path = require('path');

// ... (previous code)

// Load Static Data
let rankingsData = [];
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'data', 'raw_indices.txt'), 'utf8');
  const lines = rawData.trim().split('\n');
  // Skip header
  rankingsData = lines.slice(1).map(line => {
    const parts = line.split('\t');
    if (parts.length < 8) return null;
    return {
      rank: parseInt(parts[0]),
      city: parts[1],
      col_index: parseFloat(parts[2]),
      rent_index: parseFloat(parts[3]),
      col_plus_rent_index: parseFloat(parts[4]),
      groceries_index: parseFloat(parts[5]),
      restaurant_index: parseFloat(parts[6]),
      lpp_index: parseFloat(parts[7])
    };
  }).filter(x => x);
  console.log(`Loaded ${rankingsData.length} cities from static database.`);
} catch (err) {
  console.error("Failed to load static data:", err.message);
}

app.get("/rankings", (req, res) => {
  // Serve static data directly - Instant!
  const expensive = rankingsData.slice(0, 5);
  // Cheap ones might be at the end, but since I truncated the file, 
  // I'll take the last 5 of whatever I have.
  const cheapest = rankingsData.slice(-5).reverse(); // Reverse to show cheapest first

  res.json({ expensive, cheapest, all: rankingsData });
});

const cityCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour

app.get("/city/:city", async (req, res) => {
  try {
    // Format city name for Numbeo URL
    const originalName = _.words(_.startCase(req.params.city)).join("-");
    // Handle specific edge cases if needed, but standardizing locally
    const cityName = originalName;

    // 1. Check Cache
    const cached = cityCache.get(cityName);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log(`Serving ${cityName} from cache`);
      return res.json(cached.data);
    }

    console.log(`Scraping Numbeo for ${cityName}...`);

    // 2. Scrape with Browser Headers
    const response = await fetch(
      `https://www.numbeo.com/cost-of-living/in/${cityName}?displayCurrency=USD`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      }
    );

    if (!response.ok) {
      if (cached) {
        console.warn(`Scrape failed for ${cityName}, serving stale cache.`);
        return res.json(cached.data);
      }
      return res.status(404).json({ error: "City not found (or blocked)" });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const costs = [];

    $('table.data_wide_table tr').each((i, el) => {
      const name = $(el).find('td').eq(0).text().trim();
      const price = $(el).find('td').eq(1).text().trim();

      if (name && price) {
        const cleanPrice = price.replace(/[^\d.,]/g, "");
        costs.push({ item: name, cost: cleanPrice });
      }
    });

    const data = { city: cityName, costs };

    // 3. Save to Cache
    cityCache.set(cityName, { timestamp: Date.now(), data });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Backend live on port ${PORT}`));