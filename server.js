const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const compression = require("compression");

const app = express();
const port = process.env.PORT || 3000;

app.use(compression());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

let latestTrains = [];
let latestFull = [];

app.use(express.static(publicDir, { etag: false, maxAge: 0 }));

//ORM tilechache

const TILE_CACHE = path.join(__dirname, "tilecache");
if (!fs.existsSync(TILE_CACHE)) fs.mkdirSync(TILE_CACHE, { recursive: true });

// Serve ORM tiles from /tiles/{z}/{x}/{y}.png
app.get("/tiles/:z/:x/:y.png", async (req, res) => {
  const { z, x, y } = req.params;
  const cachePath = path.join(TILE_CACHE, `${z}_${x}_${y}.png`);

  try {
    // --- 1. Serve from cache if exists ---
    if (fs.existsSync(cachePath)) {
      res.setHeader("Content-Type", "image/png");
      return res.sendFile(cachePath);
    }

    // --- 2. fetch from OpenRailwayMap ---
    const url = `https://tiles.openrailwaymap.org/standard/${z}/${x}/${y}.png`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "VonatinfoTileProxy/1.0",
        "Referer": "https://www.openrailwaymap.org/"
      }
    });

    if (!response.ok) {
      console.log(`❌ ORM returned ${response.status} for ${z}/${x}/${y}`);
      return res.status(response.status).send("tile not available");
    }

    const buffer = await response.buffer();

    // --- 3. Save to cache ---
    fs.writeFile(cachePath, buffer, () => {});

    res.setHeader("Content-Type", "image/png");
    return res.send(buffer);

  } catch (err) {
    console.error("Tile proxy error:", err.message);
    return res.status(500).send("Internal tile proxy error");
  }
});

app.get("/api/timetables", (req, res) => {
  res.json({ data: { vehiclePositions: latestFull } });
});

app.get("/api/trains", (req, res) => {
  res.json({ data: latestTrains });
});

app.get("/", (req, res) => {
  res.send("Udv itt a Vonatinfo backendjen :)");
});

const url = "https://emma.mav.hu//otp2-backend/otp/routers/default/index/graphql";

const FULL_QUERY = {
  query: `
  {
    vehiclePositions(
      swLat: 45.7457,
      swLon: 16.2103,
      neLat: 48.5637,
      neLon: 22.9067,
      modes: [RAIL, TRAMTRAIN]
    ) {
      vehicleId
      lat
      lon
      heading
      speed
      lastUpdated
      nextStop { arrivalDelay }
      trip {
        arrivalStoptime {
          scheduledArrival
          arrivalDelay
          stop { name }
        }
        alerts(types: [ROUTE, TRIP]) { alertDescriptionText }
        tripShortName
        route { shortName }
        stoptimes {
          stop { name platformCode }
          scheduledArrival
          arrivalDelay
          scheduledDeparture
          departureDelay
        }
        tripGeometry { points }
      }
    }
  }`,
  variables: {}
};

async function fetchGraphQL(query) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/json" },
      body: JSON.stringify(query)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("GraphQL request failed:", err.message);
    return null;
  }
}

async function fetchFull() {
  const data = await fetchGraphQL(FULL_QUERY);
  if (!data?.data?.vehiclePositions) return;

  const now = Math.floor(Date.now() / 1000);
  const cutoff = 600; // 10 minutes
  const UNIX24 = (() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  })();

  // Keep current trains in a map
  const trainMap = new Map(latestFull.map(t => [t.trip?.tripShortName, t]));

  // ---- Process new incoming vehicles ----
  for (const t of data.data.vehiclePositions) {
    const id = t.trip?.tripShortName;
    if (!id) continue;

    const existing = trainMap.get(id);

    // Compute new train's arrival time (seconds since midnight CET)
    const arrNew = t.trip?.arrivalStoptime;
    const arrivalTimeNew =
      arrNew?.scheduledArrival != null
        ? arrNew.scheduledArrival + (arrNew.arrivalDelay || 0)
        : null;

    if (existing) {
      // Compute old train's arrival time
      const arrOld = existing.trip?.arrivalStoptime;
      const arrivalTimeOld =
        arrOld?.scheduledArrival != null
          ? arrOld.scheduledArrival + (arrOld.arrivalDelay || 0)
          : null;

      // If the new data refers to an already-arrived train, but the old one hasn't arrived yet → ignore update
      if (
        arrivalTimeNew != null &&
        arrivalTimeOld != null &&
        arrivalTimeNew < UNIX24 &&
        arrivalTimeOld > UNIX24
      ) {
        continue; // ignore old/messed-up update
      }

      // Otherwise, update only if newer lastUpdated or later arrival time
      if (
        t.lastUpdated > existing.lastUpdated ||
        (arrivalTimeNew != null && arrivalTimeOld != null && arrivalTimeNew >= arrivalTimeOld)
      ) {
        trainMap.set(id, t);
      }
    } else {
      // New train — add to map
      trainMap.set(id, t);
    }
  }

  // ---- Cleanup: remove old or finished trains ----
  for (const [id, train] of trainMap) {
    // Remove stale trains
    if (now - train.lastUpdated > cutoff) {
      trainMap.delete(id);
      continue;
    }

    // Remove trains whose final arrival time has already passed
  const arr = train.trip?.arrivalStoptime;
  if (arr?.scheduledArrival != null) {
    const arrivalTime = arr.scheduledArrival + (arr.arrivalDelay || 0);

    // Get current time in seconds since midnight (Europe/Budapest)
    const UNIX24 = (() => {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
      return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    })();

    // Only delete if train arrived more than 2 minutes ago
    // AND hasn't been updated in the last 2 minutes
    if (UNIX24 > arrivalTime + 60 && now - train.lastUpdated > 60) {
      trainMap.delete(id);
    }
    }
  }

  // ---- Save updated train data ----
  const newFull = Array.from(trainMap.values());
  latestFull = newFull;

  const newLight = newFull.map(t => ({    vehicleId: t.vehicleId || "",
    lat: t.lat,
    lon: t.lon,
    heading: t.heading,
    speed: t.speed,
    lastUpdated: t.lastUpdated,
    nextStop: t.nextStop ? { arrivalDelay: t.nextStop.arrivalDelay } : null,
    tripShortName: t.trip?.tripShortName,
    tripHeadsign: t.trip?.arrivalStoptime?.stop?.name || "",
    routeShortName: t.trip?.route?.shortName || ""
  }));

  latestTrains = newLight;

  fs.writeFile(path.join(publicDir, "timetables.json"), JSON.stringify({ data: { vehiclePositions: latestFull } }), () => {});
  fs.writeFile(path.join(publicDir, "trains.json"), JSON.stringify({ data: newLight }), () => {});

  console.log(`Vonatok száma: ${(latestFull.length)-1} ✅`);

  app.post('/api/timetables', (req, res) => {
    const { tripShortName } = req.body;
  if (!tripShortName) return res.status(400).json({ error: "Missing tripShortName" });

  const train = latestFull.find(t => t.trip?.tripShortName === tripShortName);
  if (!train) return res.status(404).json({ error: "Train not found" });

  res.json(train);
  });
}

fetchFull();
setInterval(fetchFull, 15000);

app.listen(port, "0.0.0.0", () => {
  console.log(`🚉 server OK`);
});