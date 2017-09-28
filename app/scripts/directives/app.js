
'use strict';

var angular = require('angular');
const mapboxgl = require('mapbox-gl');

const styles = {
    'satellite': 'mapbox://styles/mapbox/satellite-v9',
    'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v9',
    'streets': 'mapbox://styles/mapbox/streets-v9',
    'outdoors': 'mapbox://styles/mapbox/outdoors-v10',
    'light': 'mapbox://styles/mapbox/light-v9',
    'dark': 'mapbox://styles/mapbox/dark-v9',
    'northstar': 'mapbox://styles/thebluecow/cj7t3fpw70uo12sphdf24ihyo',
    'icecream': 'mapbox://styles/thebluecow/cj8260bmq9acn2rqp6rmlay4o'
}

angular.module('ijwApp')

.directive('mapbox', [
    function() {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                callback: "=",
                gsCoordinates: "=gsCoordinates"
            },
            template: "<div id='map' style='width: 600px; height: 400px;'></div>",
            link: function(scope, element, attributes) {

                var currentTime = new Date().getHours();
                var mapStyle = null;
                var offset = (currentTime + scope.gsCoordinates.location.offset) % 24;

                if (offset <= 5 || offset >= 18) {
                  mapStyle = 'icecream';
                } else {
                  mapStyle = 'streets';
                }

                mapboxgl.accessToken = 'pk.eyJ1IjoidGhlYmx1ZWNvdyIsImEiOiJjajdzdndjd3AxZDl4MzducWNsMHprMzl2In0._WHslvWYG1dB7GQQGJJ6dw';
                var map = new mapboxgl.Map({
                    container: 'map',
                    center: scope.gsCoordinates.location.global,
                    interactive: true,
                    zoom: 6,
                    style: styles[mapStyle]
                });

                // return a random floating point
                function _getRandom(min, max) {
                  return Math.random() * (max - min) + min;
                }

                // populate markerLocations array with random floats  
                var markerLocations = [];
                for (var i = 0; i < 3; i++) {
                  markerLocations.push(_getRandom(-1.5, 1.5));
                }

                // build random coordinates for the marker location
                var pointCoordinates1 = [];
                pointCoordinates1.push(scope.gsCoordinates.location.global[0] + markerLocations.pop());
                pointCoordinates1.push(scope.gsCoordinates.location.global[1] + markerLocations.pop());

                var geojson = {
                  type: 'FeatureCollection',
                  features: [{
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: pointCoordinates1
                    },
                    properties: {
                      title: 'Mapbox',
                      description: 'Cobra Operative Spotted'
                    }
                  },
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: scope.gsCoordinates.location.global
                    },
                    properties: {
                      title: 'Mapbox',
                      description: 'Cobra Operative Spotted'
                    }
                  }]
                };
                var point = 1;
                geojson.features.forEach(function(marker) {
                // create a HTML element for each feature
                var el = document.createElement('div');
                if (point % 2 === 1) {
                  el.className = 'marker';
                } else {
                  el.className = 'marker-player';
                }

                point++;

                // make a marker for each feature and add to the map
                new mapboxgl.Marker(el, /*{ offset: [-50 / 2, -50 / 2] }*/)
                .setLngLat(marker.geometry.coordinates)
                .addTo(map);
              });

              new mapboxgl.Marker(el/*, { offset: [-50 / 2, -50 / 2] }*/)
                  .setLngLat(marker.geometry.coordinates)
                  .setPopup(new mapboxgl.Popup({ offset: 25 }) // add popups
                  .setHTML('<h3>' + marker.properties.title + '</h3><p>' + marker.properties.description + '</p>'))
                  .addTo(map);
                //mapboxgl.accessToken = 'pk.eyJ1IjoidGhlYmx1ZWNvdyIsImEiOiJjajdzdndjd3AxZDl4MzducWNsMHprMzl2In0._WHslvWYG1dB7GQQGJJ6dw';
                //var map = mapboxgl.map(element[0], 'examples.map-i86nkdio');
                //scope.callback(map);
            }
        };
    }
])

.directive('ngConfirmClick', [
    function(){
        return {
            link: function (scope, element, attributes) {
                var msg = attributes.ngConfirmClick || "Are you sure?";
                var clickAction = attributes.confirmedClick;
                element.bind('click',function (event) {
                    if ( window.confirm(msg) ) {
                        scope.$eval(clickAction);
                        scope.$apply();
                    }
                });
            },
      
        };
  }]);