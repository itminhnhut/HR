import { serve } from '@hono/node-server';
import { localDevOverrides } from './local-dev.js';
import { createProductionApp } from './main.js';

const port = Number(process.env.PORT ?? 8787);
const app = createProductionApp(await localDevOverrides());
serve({ fetch: app.fetch, port }, () => {
  console.info(`API on http://localhost:${port}`);
});
