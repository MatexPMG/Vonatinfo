function init() {
    map = L.map('map', {
        center: [47.18, 19.5],
        zoom: 8,
        minZoom: 6,
        fadeAnimation: false,
        maxBounds: [
            [42.18, 4.5],
            [52.18, 34.5]
        ],
        maxBoundsViscosity: 0.5
    });

    map.zoomControl.setPosition('bottomright');

    const attr = ' CC-BY-SA <a href="https://openrailwaymap.org/">OpenRailwayMap</a>';

    const ormStandard = L.tileLayer('https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        attribution: attr
    });
    const ormSignals = L.tileLayer('https://{s}.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png', {
        attribution: attr
    });
    const ormElectrification = L.tileLayer('https://{s}.tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png', {
        attribution: attr
    });
    const ormGauge = L.tileLayer('https://{s}.tiles.openrailwaymap.org/gauge/{z}/{x}/{y}.png', {
        attribution: attr
    });
    const ormMaxspeed = L.tileLayer('https://{s}.tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png', {
        attribution: attr
    });

    const OSM = L.tileLayer.grayscale('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Térképadatok © <a href="https://openstreetmap.org/">OpenStreetMap</a> szerkesztők'
    });

    const ormLayers = {
      "Vágányzat": ormStandard,
      "Sebességkorlátok": ormMaxspeed,
      "Villamosítás": ormElectrification,
      "Vonatbefolyásolás": ormSignals,
      "Nyomtáv": ormGauge,
    };

    tLayer = L.layerGroup().addTo(map);

    L.control.layers(ormLayers).addTo(map);
    OSM.addTo(map);

    ormStandard.addTo(map);

    L.control.scale({'metric':true,'imperial':false}).addTo(map);

    L.control.locate({
      position: 'bottomright',
      showPopup: false,
      locateOptions: {
        maxZoom: 13
      }
    }).addTo(map);    
}

init();