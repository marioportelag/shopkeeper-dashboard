/** Reporting period used when the request does not specify one. */
export const DEFAULT_RANGE = Object.freeze({ from: '2020-11', to: '2021-11' });

const MAX_RANGE_MONTHS = 120;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777'];

export class InvalidRangeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidRangeError';
  }
}

/** '2020-12' -> '2021-01' */
export function nextMonth(month) {
  const [year, monthIndex] = month.split('-').map(Number);
  return monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** Every month from `from` to `to`, inclusive, in chronological order. */
export function monthSequence(from, to) {
  const months = [];
  for (let month = from; month <= to; month = nextMonth(month)) {
    months.push(month);
  }
  return months;
}

/** '2020-11' -> 'Nov 2020' */
export function formatMonthLabel(month) {
  const [year, monthIndex] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthIndex - 1]} ${year}`;
}

/**
 * Validates a `{ from, to }` pair of YYYY-MM months (e.g. from the query string)
 * and returns a half-open date range [startDate, endDateExclusive).
 */
export function parseMonthRange({ from = DEFAULT_RANGE.from, to = DEFAULT_RANGE.to } = {}) {
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !MONTH_PATTERN.test(from) ||
    !MONTH_PATTERN.test(to)
  ) {
    throw new InvalidRangeError('The "from" and "to" parameters must be months in YYYY-MM format.');
  }
  if (from > to) {
    throw new InvalidRangeError('The "from" month must not be after the "to" month.');
  }

  const months = monthSequence(from, to);
  if (months.length > MAX_RANGE_MONTHS) {
    throw new InvalidRangeError(`The reporting period cannot exceed ${MAX_RANGE_MONTHS} months.`);
  }

  return { from, to, months, startDate: `${from}-01`, endDateExclusive: `${nextMonth(to)}-01` };
}

/**
 * Monthly listing counts and average revenue per broker site.
 * Buckets by calendar month *including the year* (date_trunc), so the same
 * month in different years is never merged; the range is half-open so whole
 * last days are included regardless of the column's time component.
 */
export const LISTING_STATS_SQL = `
  SELECT s.id AS site_id,
         s.title AS broker,
         to_char(date_trunc('month', d.listing_date), 'YYYY-MM') AS month,
         COUNT(*)::int AS total_listings,
         ROUND(AVG(d.revenue)::numeric, 2)::text AS avg_revenue
    FROM deals d
    JOIN sites s ON s.id = d.site_id
   WHERE d.listing_date >= $1::date
     AND d.listing_date < $2::date
   GROUP BY s.id, s.title, date_trunc('month', d.listing_date)
   ORDER BY month, s.title, s.id`;

/** @param {{ query: (text: string, values: unknown[]) => Promise<{ rows: any[] }> }} db */
export async function fetchListingStats(db, range) {
  const { rows } = await db.query(LISTING_STATS_SQL, [range.startDate, range.endDateExclusive]);
  return rows;
}

function formatRevenue(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Shapes query rows into the table rows and chart data rendered by the dashboard. */
export function buildDashboardModel(rows, range) {
  const sorted = [...rows].sort(
    (a, b) => a.month.localeCompare(b.month) || a.broker.localeCompare(b.broker) || a.site_id - b.site_id,
  );

  const tableRows = sorted.map((row) => ({
    month: row.month,
    monthLabel: formatMonthLabel(row.month),
    broker: row.broker,
    siteId: row.site_id,
    totalListings: row.total_listings,
    avgRevenue: formatRevenue(row.avg_revenue),
  }));

  // One series per site (not per title, which need not be unique), ordered by name.
  const sites = new Map();
  for (const row of sorted) {
    if (!sites.has(row.site_id)) sites.set(row.site_id, { broker: row.broker, counts: new Map() });
    sites.get(row.site_id).counts.set(row.month, row.total_listings);
  }

  const datasets = [...sites.values()]
    .sort((a, b) => a.broker.localeCompare(b.broker))
    .map((site, index) => ({
      label: site.broker,
      data: range.months.map((month) => site.counts.get(month) ?? 0),
      borderColor: PALETTE[index % PALETTE.length],
      backgroundColor: PALETTE[index % PALETTE.length],
      fill: false,
      tension: 0.1,
    }));

  return {
    range: {
      from: range.from,
      to: range.to,
      label: `${formatMonthLabel(range.from)} – ${formatMonthLabel(range.to)}`,
    },
    tableRows,
    chart: { labels: range.months.map(formatMonthLabel), datasets },
  };
}
