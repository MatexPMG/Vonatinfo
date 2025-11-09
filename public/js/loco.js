let locoData = {};
let locoInfoUpdater = null;

// Load static loco info
fetch('json/locos.json')
  .then(res => res.json())
  .then(data => {
    locoData = data;
  });

// Helper to extract series from UIC
function uicC(uic) {
  return uic.toString().substring(5, 8);
}

// ---------------- Loco info panel ----------------
function locoInfo(train) {
  const panel = document.getElementById('loco-info');
  panel.style.display = 'block';

  const rawUIC = train.vehicleId.split(':')[1];
  const series = uicC(rawUIC);
  const loco = locoData[series];

  function uicF(uic) {
    if (!uic || uic.length < 12) return uic;
    return `${uic.slice(0,2)} ${uic.slice(2,4)} ${uic.slice(4,8)} ${uic.slice(8,11)}-${uic.slice(11)}`;
  }
  const formattedUIC = uicF(rawUIC);

  const speed = Math.round(train.speed * 3.6) || '0';
  const nick = loco?.nick || '-';
  const manufacturer = loco?.manufacturer || '-';
  const production = loco?.production || '-';
  const vmax = loco?.vmax || '-';
  const power = loco?.power || '-';
  const UIC = train.vehicleId.split(':')[1];
  const locNum = `${UIC.slice(5,8)} ${UIC.slice(8,11)}`;

  const imgSrc = `img/vehicles/${series}/${locNum}.jpg`;
  const FBCKimgSrc = `img/vehicles/${series}.jpg`;

  panel.innerHTML = `
    <h2>Vontatójármű</h2>
    <img src="${imgSrc}" alt="${series}" id="locoIMG" onerror="this.onerror=null; this.src='${FBCKimgSrc}';" />
    <p>${formattedUIC}</p>
    <table>
      <tr><td>Sebesség:</td><td id="loco-speed">${speed} km/h</td></tr>
      <tr class="odd"><td>Engedélyezett sebesség:</td><td>${vmax} km/h</td></tr>
      <tr><td>Becenév:</td><td>${nick}</td></tr>
      <tr class="odd"><td>Gyártó:</td><td>${manufacturer}</td></tr>
      <tr><td>Gyártásban:</td><td>${production}</td></tr>
      <tr class="odd"><td>Teljesítmény:</td><td>${power}</td></tr>
    </table>
  `;
}

// ---------------- Update only speed dynamically ----------------
function updateLocoSpeed(train) {
  const speedElem = document.getElementById('loco-speed');
  if (!speedElem || !train) return;

  const speed = Math.round(train.speed * 3.6) || '0';
  speedElem.textContent = `${speed} km/h`;
}

// ---------------- Start loco info updater ----------------
function LocoUpdate(name) {
  // Clear previous interval if exists
  if (locoInfoUpdater) clearInterval(locoInfoUpdater);

  // Get latest train object
  const train = trainDataMap.get(name);
  if (!train) return;

  // Render panel once
  locoInfo(train);

  // Start interval to update speed every 5s
  locoInfoUpdater = setInterval(() => {
    const currentTrain = trainDataMap.get(name);
    if (currentTrain) updateLocoSpeed(currentTrain);
  }, 5000);
}
