var $http = require('http');
var api = require('../../../src/api.json');
var URL = 'http://api.openweathermap.org/data/2.5/weather';
var string = 'London,uk'

// Print error message 
function printError(error) {
  console.error(error.message);
};

function printMessage(weather) {
  // temp comes in Kelvin
  const fahrenheit = (1.8 * (weather.main.temp - 273) + 32).toFixed(2);
  const message = `
  	The temperature in ${weather.name} is ${fahrenheit}F.
	----
	Sunrise is ${convertUnixTime(weather.sys.sunrise)} and sunset is ${convertUnixTime(weather.sys.sunset)}.
	----
	How does today look? Well we have ${weather.weathter[0].description}.`;
	/* ${weather.weather[0].main} and it is */
  
	console.log(message);
}

function convertUnixTime(time) {
	return new Date(time * 1000).toString().substring(4, 24);
}

function get(lon, lat) {
    var query = '?lat=' + lat + '&lon=' + lon;
    
    var newURL = `${URL}${query}&APPID=${api.openweather.key}`;

    // return $http.get(newURL);

    var request = $http.get(newURL, response => {
        var weather = null;

          if (response.statusCode === 200) {
            
            var body = '';
            response.on('data', data => {                    
              body += data.toString();
            }); 
      
            response.on('end', () => {
              try {
               var weather = JSON.parse(body);
                  console.log(weather);
                } catch (e) {
                  console.error(e);
                }
              });
            } else {
              var message = `There was an error (${http.STATUS_CODES[response.statusCode]}).`;
              var statusCodeError = new Error(message);
              console.error(statusCodeError);
            }
        });
}



module.exports.get = get;