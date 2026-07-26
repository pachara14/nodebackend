const { createServer } = require('./server');

const port = Number(process.env.PORT) || 3000;
const server = createServer();

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
