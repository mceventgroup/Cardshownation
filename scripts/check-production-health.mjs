const database = process.argv.includes('--database');
const target = `https://www.cardshownation.com/api/health${database ? '' : '/app'}`;
async function check() {
  const response = await fetch(target, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Health returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== 'ok') throw new Error(`${database ? 'Database' : 'Application'} health is not ok`);
  const age = Date.now() - Date.parse(body.timestamp);
  if (!Number.isFinite(age) || age > 120_000 || age < -60_000) throw new Error('Health response is stale or missing its timestamp');
}
try {
  await check();
  console.log(`Production ${database ? 'database' : 'application'} health passed.`);
} catch (firstError) {
  console.warn(`Initial health check failed: ${firstError.message}. Retrying in 20 seconds.`);
  await new Promise(resolve => setTimeout(resolve, 20_000));
  await check();
  console.log('Production health recovered on retry.');
}
