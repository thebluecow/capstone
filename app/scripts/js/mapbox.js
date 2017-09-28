'use strict';

const mapboxgl = require('mapbox-gl');

// longitude, latitude format
const coordinates = {
  "amazon"  : [-62.215881, -3.465305],
  "siberia-oblast" : [82.93573270000002, 55.00835259999999]
}

const styles = {
  'satellite'         : 'mapbox://styles/mapbox/satellite-v9',
  'satellite-streets' : 'mapbox://styles/mapbox/satellite-streets-v9',
  'streets'           : 'mapbox://styles/mapbox/streets-v9',
  'outdoors'          : 'mapbox://styles/mapbox/outdoors-v9',
  'light'             : 'mapbox://styles/mapbox/light-v9',
  'dark'              : 'mapbox://styles/mapbox/dark-v9'
}

mapboxgl.accessToken = 'pk.eyJ1IjoidGhlYmx1ZWNvdyIsImEiOiJjajdzdndjd3AxZDl4MzducWNsMHprMzl2In0._WHslvWYG1dB7GQQGJJ6dw';
var map = new mapboxgl.Map({
    container: 'map',
    center: coordinates.amazon,
    zoom: 4,
    style: 'mapbox://styles/thebluecow/cj7t3fpw70uo12sphdf24ihyo'
});

map.on('load', function() {
  map.addLayer({
    id: 'rpd_parks',
    type: 'fill',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.3o7ubwm8'
    },
    'source-layer': 'RPD_Parks',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'fill-color': 'rgba(61,153,80,0.55)'
    }
  });
});

module.exports.map = map;