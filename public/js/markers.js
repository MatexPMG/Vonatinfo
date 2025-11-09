let trainDataMap = new Map();
let mapClickHandlerAttached = false;

function markers() {
  fetch('https://vinfo-production.up.railway.app/api/trains')
    .then(res => res.json())
    .then(json => {
      trainLayer.clearLayers();
      trainMarkers.clear();

      const trains = json.data || [];

      trains.forEach(train => {

        const vehicleId = train.vehicleId ?? "";
        const name = train.tripShortName ?? "";
        trainDataMap.set(name, train);

        const delay = Math.round((train.nextStop?.arrivalDelay ?? 0) / 60);
        const lat = train.lat;
        const lon = train.lon;
        const heading = train.heading ?? 0;
        const speed = Math.round((train.speed ?? 0) * 3.6);
        const dest = train.tripHeadsign ?? "";
        const icon = train.routeShortName ?? "";

        const UIC = vehicleId.includes(':') ? vehicleId.split(':')[1] : vehicleId;
        const loc = UIC ? `${UIC.slice(5, 8)} ${UIC.slice(8, 11)}` : "";
        const searchId = `${name} | ${loc}`;

        const marker = L.marker([lat, lon], {
          trainData: train,
          UIC: loc,
          icon: L.divIcon({
            html: `
              <div class="train-marker">
                <div class="circle" style="background-color: ${delCol(delay)};"></div>
                ${speed > 0 ? `
                  <div class="arrow" style="
                    transform: translate(-50%, -50%) rotate(${heading}deg) translateY(-13px);
                  "></div>` : ""}
              </div>
            `,
            className: "marker",
            iconAnchor: [9, 9],
          }),
        });

        trainMarkers.set(searchId, marker);

        marker.on('click', () => {
          selectedTrainId = name;
          TTupdate(train); //post
          LocoUpdate(name);

          if (selected) map.removeLayer(selected);
          selected = L.circleMarker([lat, lon], {
            radius: 22,
            color: 'aqua',
            fillColor: 'aqua',
            fillOpacity: 0.75,
            weight: 0
          }).addTo(map);
        });

        const popupContent = `
          <div class="custom-popup">
            <b>${icon} ${name} &rarr;</b> ${dest}
            <i>${delay > 0 ? "+" + delay : delay}</i>
          </div>
        `;
        const popup = L.popup({
          className: 'custom-popup',
          closeButton: false,
          autoPan: false,
          maxWidth: 600
        }).setContent(popupContent);

        marker.on('mouseover', () => marker.bindPopup(popup).openPopup());
        marker.on('mouseout', () => marker.closePopup());

        trainLayer.addLayer(marker);

        if (selectedTrainId === name && selected)
          selected.setLatLng([lat, lon]);
      });

      if (!mapClickHandlerAttached) {
        map.on('click', () => {
          if (selected) {
            map.removeLayer(selected);
            selected = null;
          }
          selectedTrainId = null;

          document.getElementById("train-info").style.display = "none";
          document.getElementById("loco-info").style.display = "none";

          if (trainInfoUpdater) {
            clearTimeout(trainInfoUpdater);
            clearInterval(trainInfoUpdater);
            trainInfoUpdater = null;
          }
          if (locoInfoUpdater) {
            clearTimeout(locoInfoUpdater);
            clearInterval(locoInfoUpdater);
            locoInfoUpdater = null;
          }
          if (window.activeRoute) map.removeLayer(window.activeRoute);
        });
        mapClickHandlerAttached = true;
      }
    }
  );
}

function delCol(delay) {
  if (delay <= 5) return 'rgb(59, 233, 42)';
  if (delay <= 19) return 'rgb(251, 255, 0)';
  if (delay <= 59) return 'rgb(255, 165, 0)';
  if (delay >= 60) return 'rgb(255, 0, 17)';
  return 'rgb(59, 233, 42)';
}

markers();
setInterval(markers, 20000);