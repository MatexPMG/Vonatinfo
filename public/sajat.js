let map;
let a = null;
let tlay;

let aID = null;

const tMark = new Map();
const b = document.getElementById("trainSearch");
const cBox = document.getElementById('suggestions');

function init() {
    map = L.map('map', {
        center: [47.18, 19.5],
        zoom: 8,
        minZoom: 6,
        maxZoom: 17,
        fadeAnimation: false,
        maxBounds: [
            [42.18, 4.5],
            [52.18, 34.5]
        ],
        maxBoundsViscosity: 0.5
    })
    map.zoomControl.setPosition('bottomright');

    const ab = ' CC-BY-SA <a href="https://openrailwaymap.org/">OpenRailwayMap</a>';

    
}