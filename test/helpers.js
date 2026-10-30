import { createApp } from '../src/app.js';

/** A fake `pg` pool that records queries and returns the given rows (or throws). */
export function fakeDb({ rows = [], error } = {}) {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      if (error) throw error;
      return { rows };
    },
  };
}

/** Captures logged errors instead of printing them. */
export function silentLogger() {
  const errors = [];
  return { errors, error: (...args) => errors.push(args) };
}

export function buildApp({ rows, error } = {}) {
  const db = fakeDb({ rows, error });
  const logger = silentLogger();
  return { app: createApp({ db, logger }), db, logger };
}

/** Extracts and parses the JSON data block embedded in the dashboard HTML. */
export function extractChartData(html) {
  const match = html.match(/<script type="application\/json" id="chart-data">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('chart-data block not found');
  return JSON.parse(match[1]);
}

export function row(month, siteId, broker, totalListings, avgRevenue = '1000.00') {
  return { month, site_id: siteId, broker, total_listings: totalListings, avg_revenue: avgRevenue };
}
