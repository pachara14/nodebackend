const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createServer } = require('../src/server');

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET'
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

test('GET /health returns ok status', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const port = server.address().port;
    const response = await request(port, '/health');

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /application\/json/);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /unknown returns 404', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const port = server.address().port;
    const response = await request(port, '/unknown');

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), { error: 'Not Found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
