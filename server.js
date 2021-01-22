const compression = require('compression');
const express = require('express');
const BlueLinky = require('bluelinky');
const bodyParser = require('body-parser');
const auth = require('http-auth');
const authConnect = require("http-auth-connect");
const config = require('/config/config.json');
const winston = require('winston');
const expressWinston = require('express-winston');
const winstonLogrotate = require('winston-logrotate');
var Rotate = require('winston-logrotate').Rotate;
var apicache = require('apicache')

let cache = apicache.options({
    trackPerformance: true,
    debug: true
}).middleware

const onlyStatus200 = (req, res) => res.statusCode === 200
 
let cacheSuccesses = cache('2 hours', onlyStatus200)

const digest = auth.digest({
    realm: 'Bluelinky',
    file: "/config/users.htpasswd",
    algorithm:'md5'
});

const client = new BlueLinky({ 
  username: config.username, 
  password: config.password,
  pin: config.pin,
  region: config.region
});

let vehicle;
const app = express();

client.on('ready', async () => {
  vehicle = client.getVehicle(config.vin);
});


app.use(authConnect(digest));
app.use(compression());
app.use(bodyParser.json());
app.use(expressWinston.logger({
      transports: [
        new winston.transports.Console(),
    new Rotate({ file: 'error.log', level: 'error' }),
    new Rotate({ file: 'combined.log' })
      ],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
      ),
      meta: true, // optional: control whether you want to log the meta data about the request (default to true)
      msg: "HTTP {{res.statusCode}} {{req.method}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
      expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
      colorize: true, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
      ignoreRoute: function (req, res) { return false; } // optional: allows to skip some log messages based on request and/or response
    }));


const middleWare = async (req, res, next) => {
  const ip = req.connection.remoteAddress;
  console.log(req.path, ip);
  return next();
};

app.use(middleWare);

app.post('/start', async (req, res) => {
  let response;
  try {
    response = await vehicle.start({
      airCtrl: true,
      igniOnDuration: 10,
      airTempvalue: 60
    });
  } catch (e) {
    response = {
      error: e.message
    };
  }
  res.send(response);
});

app.post('/lock', async (req, res) => {
  let response;
  try {
    response = await vehicle.lock();
  } catch (e) {
    console.log(e);
    response = {
      error: e.message
    };
  }
  res.send(response);
});

app.get('/', cacheSuccesses, async (req, res) => {
  let response, response2;
  try {
      
    response = await vehicle.status();
    response2 = await vehicle.location();
    response.location = response2; 
      console.log("updated real data");
  } catch (e) {
    console.log(e);
    response = {
      error: e.message
    };
  }
  res.send(response);
});

app.get('/location', cacheSuccesses, async (req, res) => {
  let response;
  try {
      const client = new BlueLinky({ 
        username: config.username, 
        password: config.password,
        pin: config.pin,
        region: config.region
      });

      client.on('ready', async () => {
        vehicle = client.getVehicle(config.vin);
        response = await vehicle.location();

      });
  } catch (e) {
    console.log(e);
    response = {
      error: e.message
    };
  }
  res.send(response);
  
});

app.get('/update', async (req, res) => {
  let response;
  try {
      const client = new BlueLinky({ 
        username: config.username, 
        password: config.password,
        pin: config.pin,
        region: config.region
      });

      client.on('ready', async () => {
        vehicle = client.getVehicle(config.vin);
        response = await vehicle.status({refresh: true});
        apicache.clear();
      });
  } catch (e) {
    console.log(e);
    response = {
      error: e.message
    };
  }
  res.send(response);

});

// add route to display cache performance (courtesy of @killdash9)
app.get('/api/cache/performance', (req, res) => {
  res.json(apicache.getPerformance())
})

// add route to display cache index
app.get('/api/cache/index', (req, res) => {
  res.json(apicache.getIndex())
})

app.listen(8080, '0.0.0.0');
