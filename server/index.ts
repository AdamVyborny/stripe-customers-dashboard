import express from 'express';
import path from 'path';

const app = express();
const clientDir = path.join(__dirname, '../client');
const port = Number(process.env.PORT ?? 3000);

const { KBC_URL, KBC_TOKEN, BRANCH_ID, WORKSPACE_ID } = process.env as Record<string, string>;
const QUERY_HOST = KBC_URL?.replace('://connection.', '://query.') ?? '';

async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
  const submit = await fetch(
    `${QUERY_HOST}/api/v1/branches/${BRANCH_ID}/workspaces/${WORKSPACE_ID}/queries`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-StorageAPI-Token': KBC_TOKEN },
      body: JSON.stringify({ statements: [sql], transactional: false }),
    },
  );
  if (!submit.ok) throw new Error(`submit failed: ${submit.status} ${await submit.text()}`);
  const { queryJobId } = (await submit.json()) as { queryJobId: string };

  let statementId = '';
  let lastStatus = 'unknown';
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    const st = await fetch(`${QUERY_HOST}/api/v1/queries/${queryJobId}`, {
      headers: { 'X-StorageAPI-Token': KBC_TOKEN },
    });
    const job = (await st.json()) as { status: string; statements: { id: string }[] };
    lastStatus = job.status;
    if (job.status === 'completed') { statementId = job.statements[0].id; break; }
    if (job.status === 'failed' || job.status === 'canceled') throw new Error(`query ${job.status}`);
  }
  if (!statementId) throw new Error(`query timed out (last status: ${lastStatus})`);

  const res = await fetch(
    `${QUERY_HOST}/api/v1/queries/${queryJobId}/${statementId}/results?offset=0&pageSize=500`,
    { headers: { 'X-StorageAPI-Token': KBC_TOKEN } },
  );
  const { columns, data } = (await res.json()) as { columns: { name: string }[]; data: string[][] };
  return data.map((row) => Object.fromEntries(columns.map((c, i) => [c.name, row[i]])));
}

app.use(express.json());
app.use(express.static(clientDir));

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [kpis, byCountry, monthly, topCustomers] = await Promise.all([
      runQuery(`
        SELECT
          (SELECT COUNT(*) FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."customers") AS "totalCustomers",
          (SELECT COUNT(DISTINCT CASE WHEN "address_country" != '' THEN "address_country" END) FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."customers") AS "countries",
          (SELECT COALESCE(SUM(TRY_CAST("amount" AS NUMBER)), 0) FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."charges" WHERE "status" = 'succeeded') AS "totalRevenue",
          (SELECT COUNT(*) FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."customers" WHERE TRY_CAST("created" AS NUMBER) >= EXTRACT(EPOCH FROM DATEADD(day, -30, CURRENT_TIMESTAMP()))) AS "recentCustomers"
      `),
      runQuery(`
        SELECT "address_country" AS "country", COUNT(*) AS "count"
        FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."customers"
        WHERE "address_country" != ''
        GROUP BY "address_country"
        ORDER BY "count" DESC
        LIMIT 10
      `),
      runQuery(`
        SELECT TO_CHAR(TO_TIMESTAMP(TRY_CAST("created" AS NUMBER)), 'YYYY-MM') AS "month", COUNT(*) AS "customers"
        FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."customers"
        WHERE TRY_CAST("created" AS NUMBER) IS NOT NULL
        GROUP BY "month"
        ORDER BY "month"
      `),
      runQuery(`
        SELECT cu."name", cu."email", cu."address_country" AS "country",
               COUNT(ch."id") AS "charges",
               COALESCE(SUM(TRY_CAST(ch."amount" AS NUMBER)), 0) AS "revenue"
        FROM "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."customers" cu
        LEFT JOIN "KEBOOLA_198"."in.c-keboola-ex-stripe-31606"."charges" ch
          ON ch."customer" = cu."id" AND ch."status" = 'succeeded'
        GROUP BY cu."name", cu."email", cu."address_country"
        ORDER BY "revenue" DESC
        LIMIT 20
      `),
    ]);

    const k = kpis[0];
    res.json({
      kpis: {
        totalCustomers: Number(k.totalCustomers),
        countries: Number(k.countries),
        totalRevenue: Number(k.totalRevenue),
        recentCustomers: Number(k.recentCustomers),
      },
      byCountry: byCountry.map((r) => ({ country: r.country, count: Number(r.count) })),
      monthlyTrend: monthly.map((r) => ({ month: r.month, customers: Number(r.customers) })),
      topCustomers: topCustomers.map((r) => ({
        name: r.name, email: r.email, country: r.country,
        charges: Number(r.charges), revenue: Number(r.revenue),
      })),
    });
  } catch (err) {
    console.error('Dashboard query error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.all('/', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));

app.listen(port, '127.0.0.1', () => console.log(`Server up on ${port}`));
