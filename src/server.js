const http = require('node:http');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'GET' && req.url === '/') {
      sendJson(res, 200, { message: 'backend ready' });
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  });
}

module.exports = { createServer };
