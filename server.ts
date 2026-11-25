import express from 'express';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachMultiplayerServer } from './server/multiplayer.ts';

const app = express();
const httpServer = createServer(app);
const projectRoot = dirname(fileURLToPath(import.meta.url));

app.use(express.static(resolve(projectRoot, 'dist')));
app.get('*', (_request, response) => {
  response.sendFile(resolve(projectRoot, 'dist', 'index.html'));
});

attachMultiplayerServer(httpServer);

const port = Number(process.env.PORT || 3000);
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Cabol Cabut Bool server listening on port ${port}`);
});
