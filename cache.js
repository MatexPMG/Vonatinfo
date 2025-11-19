const TILE_CACHE_BASE = path.join(__dirname, "tilecache");
if (!fs.existsSync(TILE_CACHE_BASE)) fs.mkdirSync(TILE_CACHE_BASE, { recursive: true });

// Europe bounding box
const EUR = {
  minLat: 34.0,
  maxLat: 72.0,
  minLon: -12.0,
  maxLon: 32.0
};

// Converts tile x/y/z → lat/lon
function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function tile2lon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function isTileInEurope(x, y, z) {
  const lat = tile2lat(y, z);
  const lon = tile2lon(x, z);
  return (
    lat >= EUR.minLat &&
    lat <= EUR.maxLat &&
    lon >= EUR.minLon &&
    lon <= EUR.maxLon
  );
}

// ------ CLEANUP: delete tiles older than 7 days ------
const CLEANUP_DAYS = 7;
setInterval(() => {
  const cutoff = Date.now() - CLEANUP_DAYS * 24 * 3600 * 1000;

  function cleanupDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const fp = path.join(dir, file);
      const st = fs.statSync(fp);
      if (st.mtimeMs < cutoff) fs.unlinkSync(fp);
    }
  }

  for (const layer of fs.readdirSync(TILE_CACHE_BASE)) {
    const layerDir = path.join(TILE_CACHE_BASE, layer);
    cleanupDir(layerDir);
  }
}, 3600 * 1000); // run every hour

// ------ TILE PROXY ------
app.get("/tiles/:layer/:z/:x/:y.png", async (req, res) => {
  const { layer, z, x, y } = req.params;
  const zoom = parseInt(z, 10);
  const X = parseInt(x, 10);
  const Y = parseInt(y, 10);

  // Only cache zoom 6→16
  const cacheEnabled = zoom >= 6 && zoom <= 16;

  // Only cache if tile is inside Europe
  const inEurope = isTileInEurope(X, Y, zoom);

  const layerDir = path.join(TILE_CACHE_BASE, layer);
  if (cacheEnabled && inEurope && !fs.existsSync(layerDir))
    fs.mkdirSync(layerDir, { recursive: true });

  const cachePath = path.join(layerDir, `${z}_${x}_${y}.png`);

  try {
    // Serve from cache
    if (cacheEnabled && inEurope && fs.existsSync(cachePath)) {
      res.setHeader("Content-Type", "image/png");
      return res.sendFile(cachePath);
    }

    // Fetch from ORM
    const url = `https://tiles.openrailwaymap.org/${layer}/${z}/${x}/${y}.png`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VonatinfoTileProxy/1.0",
        "Referer": "https://www.openrailwaymap.org/"
      }
    });

    if (!response.ok)
      return res.status(response.status).send("tile not available");

    const buffer = await response.buffer();

    // Save only European tiles and zoom 6–16
    if (cacheEnabled && inEurope) fs.writeFile(cachePath, buffer, () => {});

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error("Tile proxy error:", err);
    res.status(500).send("Internal tile proxy error");
  }
});
