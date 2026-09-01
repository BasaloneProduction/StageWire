const apiPort = Number(process.env.API_PORT || 5174);
const url = `http://127.0.0.1:${apiPort}/api/healthz`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= 24; attempt += 1) {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.ok && body?.status === 'ok') {
      console.log('StageWire API and ownership schema are ready.');
      process.exit(0);
    }

    if (response.status === 503 && body?.status === 'database-unready') {
      console.error('');
      console.error('StageWire database schema is not ready for the worker-ownership build.');
      console.error('Run this once against the intended development database: pnpm db:prepare');
      console.error('StageWire will not modify a real database automatically.');
      console.error('');
      process.exit(2);
    }
  } catch {
    // The API may still be compiling or binding its port. Retry briefly.
  }

  await sleep(250);
}

console.error(`StageWire API did not become ready at ${url}.`);
process.exit(1);
