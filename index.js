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

app.get("/api/timetables", (req, res) => {
  res.json({ data: { vehiclePositions: latestFull } });
});

app.get("/api/trains", (req, res) => {
  res.json({ data: latestTrains });
});

app.get("/", (req, res) => {
  res.send("Backend running 🚆 — use /api/trains for lightweight data.");
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
  const cutoff = 10 * 60;

  let allTrains = data.data.vehiclePositions;
  const activeTrains = allTrains.filter(t => now - t.lastUpdated <= cutoff);
  latestFull = activeTrains;

  const newLight = latestFull.map(t => ({
    vehicleId: t.vehicleId || "",
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
setInterval(fetchFull, 15 * 1000);

app.listen(port, "0.0.0.0", () => {
  console.log(`🚉 server OK`);
});
