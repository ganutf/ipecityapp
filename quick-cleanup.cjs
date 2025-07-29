require('dotenv').config();
const { Client } = require('pg');

async function cleanup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query("DELETE FROM attestations WHERE status = 'failed'");
  console.log(`✅ Deleted ${result.rowCount} failed attestation records`);
  await client.end();
}

cleanup().catch(console.error);