'use strict';

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10);

if (!Number.isInteger(port) || port <= 0) {
  console.error('PORT is required and must be a positive integer.');
  process.exit(1);
}

const app = next({
  dev: false,
  hostname,
  port,
});
const handle = app.getRequestHandler();

function failStartup(err) {
  console.error('Gym OS failed to start.');
  if (err && err.message) {
    console.error(err.message);
  }
  process.exit(1);
}

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl).catch((err) => {
        console.error('Request handler error.');
        if (err && err.message) {
          console.error(err.message);
        }
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    });

    server.on('error', failStartup);

    server.listen(port, hostname, () => {
      console.log('Gym OS production server is ready.');
    });
  })
  .catch(failStartup);
