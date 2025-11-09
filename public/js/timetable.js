let trainInfoUpdater = null;
let savedScrollTop = null;  // keep scroll position
let firstRenderDone = false; // track if first render happened

function TTupdate(train) {
  // clear any previous updater
  if (trainInfoUpdater) {
    clearTimeout(trainInfoUpdater);
    clearInterval(trainInfoUpdater);
    trainInfoUpdater = null;
  }

  // reset scroll tracking on new train 
  savedScrollTop = null;
  firstRenderDone = false;

  // internal helper to fetch and display timetable data
  function fetchAndRender() {
    if (!train?.tripShortName) return;

    fetch('https://vinfo-production.up.railway.app/api/timetables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tripShortName: train.tripShortName })
    })
    .then(res => {
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      // show timetable data for this train
      showTrainInfo(data);
    })
    .catch(err => {
      console.error('Error fetching timetable:', err);
    });
  }

  // initial fetch
  fetchAndRender();

  // schedule next update exactly at start of next minute
  function scheduleNextMinute() {
    const now = new Date();
    const msToNextMinute = (63 - now.getSeconds()) * 1000 - now.getMilliseconds();

    trainInfoUpdater = setTimeout(() => {
      fetchAndRender();
      // switch to interval for every 60s
      trainInfoUpdater = setInterval(fetchAndRender, 60 * 1000);
    }, msToNextMinute);
  }

  scheduleNextMinute();
}

function showTrainInfo(train) {
  const container = document.getElementById('train-info');
  container.style.display = 'block';

  const name = train.trip?.tripShortName || 'N/A';
  const icon = train.trip?.route?.shortName || '';

  const dest = train.trip?.arrivalStoptime?.stop.name || 'N/A';
  const delay = Math.round(train.nextStop?.arrivalDelay / 60);
  const delayHTML = delay > 0 ? `<h2>A pillanatnyi késés ${delay} perc</h2>`: '';
  const alert = train.trip.alerts?.[0]?.alertDescriptionText || null;
  const alertHTML = alert ? `<h3>${alert}</h3>` : '';

  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let lastPassedIndex = 0;

  const rows = train.trip.stoptimes.map((stop, i, arr) => {
    const schedArr = formatTime(stop.scheduledArrival);
    const schedDep = formatTime(stop.scheduledDeparture);
    const realArr = stop.arrivalDelay
      ? formatTime(stop.scheduledArrival + stop.arrivalDelay)
    : schedArr;
    const realDep = stop.departureDelay
      ? formatTime(stop.scheduledDeparture + stop.departureDelay)
    : schedDep;

    let arrClass = "ontime";
    if (stop.arrivalDelay < 0) arrClass = "early";
    else if (stop.arrivalDelay > 0) arrClass = "delayed";

    let depClass = "ontime";
    if (stop.departureDelay < 0) depClass = "early";
    else if (stop.departureDelay > 0) depClass = "delayed";

    const depTimeSec = stop.scheduledDeparture + (stop.departureDelay || 0);
    const rowClass = depTimeSec < nowSec
    ? (i % 2 === 0 ? "past even" : "past odd")
    : (i % 2 === 0 ? "future even" : "future odd");

    if (depTimeSec < nowSec) {
      lastPassedIndex = i;
    }

    const showArr = i > 0;
    const showDep = i < arr.length-1;

    return `
      <tr class="${rowClass}" id="station-row-${i}">
        <td id="stationN" rowspan="2">${stop.stop.name}</td>
          <td id="SchArr">${showArr ? schedArr : ""}</td>
          <td id="SchDep">${showDep ? schedDep : ""}</td>
        <td id="platformN" rowspan="2">${stop.stop.platformCode || '-'}</td>
      </tr>
      <tr class="${rowClass}">
        <td class="real ${arrClass}">${showArr ? realArr : ""}</td>
        <td class="real ${depClass}">${showDep ? realDep : ""}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
  <div class="timetable">
    <h1>
      ${name}
    </h1>
    <h6>
      <span>${icon}</span> → ${dest}
    </h6>
    ${delayHTML}
    ${alertHTML}
    <div class="tbody-container" id="tbody-container">
      <table>
        <thead>
          <tr>
            <th class="all">Állomás</th>
            <th class="erk">Érkezés</th>
            <th class="ind">Indulás</th>
            <th class="vg">Vágány</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
  `;

  const tbodyContainer = document.getElementById("tbody-container");

  // restore saved scroll position if exists
  if (savedScrollTop !== null) {
    tbodyContainer.scrollTop = savedScrollTop;
  } else if (!firstRenderDone) {
    // only on very first render: scroll to current station
    const lastRow = document.getElementById(`station-row-${lastPassedIndex}`);
    if (lastRow) {
      lastRow.scrollIntoView({ block: "center"});
    }
    firstRenderDone = true;
  }

  // listen for manual scroll changes and store them
  tbodyContainer.onscroll = () => {
    savedScrollTop = tbodyContainer.scrollTop;
  };

  //poly
  if (window.activeRoute) map.removeLayer(window.activeRoute);
  window.activeRoute = poly(train.trip.tripGeometry, map);
}

function formatTime(seconds) {
  const d = new Date(0);
  d.setSeconds(seconds);
  return d.toISOString().substr(11, 5); 
}
