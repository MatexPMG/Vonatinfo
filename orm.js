const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Your cache folder
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

app.get("/tiles/:z/:x/:y.png", async (req, res) => {
    const { z, x, y } = req.params;
    const cachePath = path.join(CACHE_DIR, `${z}_${x}_${y}.png`);

    // If already cached → return file
    if (fs.existsSync(cachePath)) {
        return res.sendFile(cachePath);
    }

    // Otherwise fetch from ORM
    const url = `https://tiles.openrailwaymap.org/standard/${z}/${x}/${y}.png`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "RailwayPersonalUseClient",
                "Referer": "https://www.openrailwaymap.org/",
            }
        });

        if (!response.ok) {
            return res.status(response.status).send("error");
        }

        const buffer = await response.buffer();

        // Save to cache
        fs.writeFileSync(cachePath, buffer);
        res.set("Content-Type", "image/png");
        return res.send(buffer);

    } catch (err) {
        return res.status(500).send("Fetch failed");
    }
});

app.listen(PORT, () => console.log("Tile proxy running on", PORT));
