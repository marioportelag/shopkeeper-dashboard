import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDashboardModel,
  DEFAULT_RANGE,
  fetchListingStats,
  formatMonthLabel,
  InvalidRangeError,
  LISTING_STATS_SQL,
  monthSequence,
  nextMonth,
  parseMonthRange,
} from '../src/listings.js';
import { fakeDb, row } from './helpers.js';

describe('month helpers', () => {
  it('advances across a year boundary', () => {
    assert.equal(nextMonth('2020-11'), '2020-12');
    assert.equal(nextMonth('2020-12'), '2021-01');
  });

  it('builds an inclusive, chronological month sequence across years', () => {
    assert.deepEqual(monthSequence('2020-11', '2021-02'), ['2020-11', '2020-12', '2021-01', '2021-02']);
  });

  it('formats labels with the year so equal months in different years are distinguishable', () => {
    assert.equal(formatMonthLabel('2020-11'), 'Nov 2020');
    assert.equal(formatMonthLabel('2021-11'), 'Nov 2021');
  });
});

describe('parseMonthRange', () => {
  it('defaults to the original reporting period, Nov 2020 – Nov 2021', () => {
    const range = parseMonthRange({});

    assert.equal(range.from, DEFAULT_RANGE.from);
    assert.equal(range.to, DEFAULT_RANGE.to);
    assert.equal(range.months.length, 13);
  });

  it('produces a half-open date range that includes the whole last month', () => {
    const range = parseMonthRange({ from: '2020-11', to: '2021-11' });

    assert.equal(range.startDate, '2020-11-01');
    assert.equal(range.endDateExclusive, '2021-12-01');
  });

  it('handles a December end month', () => {
    assert.equal(parseMonthRange({ from: '2021-01', to: '2021-12' }).endDateExclusive, '2022-01-01');
  });

  for (const [description, input] of [
    ['malformed month', { from: '2021-13', to: '2021-12' }],
    ['full date instead of month', { from: '2021-01-01', to: '2021-12' }],
    ['injection attempt', { from: "2021-01'; DROP TABLE deals;--", to: '2021-12' }],
    ['repeated query parameter (array)', { from: ['2021-01', '2021-02'], to: '2021-12' }],
    ['from after to', { from: '2022-01', to: '2021-12' }],
    ['period longer than 10 years', { from: '2000-01', to: '2021-12' }],
  ]) {
    it(`rejects a ${description}`, () => {
      assert.throws(() => parseMonthRange(input), InvalidRangeError);
    });
  }
});

describe('fetchListingStats', () => {
  it('passes the date range as bind parameters, never interpolated into SQL', async () => {
    const db = fakeDb({ rows: [] });
    await fetchListingStats(db, parseMonthRange({ from: '2020-11', to: '2021-11' }));

    assert.equal(db.calls.length, 1);
    assert.deepEqual(db.calls[0].values, ['2020-11-01', '2021-12-01']);
    assert.ok(!db.calls[0].text.includes('2020-11'));
  });

  it('buckets by year and month rather than by month number alone (regression for audit finding S3)', () => {
    assert.match(LISTING_STATS_SQL, /date_trunc\('month', d\.listing_date\)/);
    assert.doesNotMatch(LISTING_STATS_SQL, /EXTRACT\s*\(\s*MONTH/i);
    assert.doesNotMatch(LISTING_STATS_SQL, /BETWEEN/i);
  });
});

describe('buildDashboardModel', () => {
  const range = parseMonthRange({ from: '2020-11', to: '2021-11' });

  it('keeps the same month in different years as separate data points', () => {
    const model = buildDashboardModel(
      [row('2020-11', 1, 'Harbor', 4), row('2021-11', 1, 'Harbor', 9)],
      range,
    );

    const [dataset] = model.chart.datasets;
    assert.equal(dataset.data[0], 4, 'Nov 2020');
    assert.equal(dataset.data[12], 9, 'Nov 2021');
    assert.equal(
      dataset.data.reduce((sum, n) => sum + n, 0),
      13,
    );
    assert.deepEqual(
      model.tableRows.map((r) => r.monthLabel),
      ['Nov 2020', 'Nov 2021'],
    );
  });

  it('labels the chart axis chronologically across the year boundary', () => {
    const model = buildDashboardModel([], range);

    assert.deepEqual(model.chart.labels, [
      'Nov 2020',
      'Dec 2020',
      'Jan 2021',
      'Feb 2021',
      'Mar 2021',
      'Apr 2021',
      'May 2021',
      'Jun 2021',
      'Jul 2021',
      'Aug 2021',
      'Sep 2021',
      'Oct 2021',
      'Nov 2021',
    ]);
  });

  it('sorts table rows chronologically even when input is out of order', () => {
    const model = buildDashboardModel(
      [
        row('2021-01', 1, 'Harbor', 1),
        row('2020-12', 2, 'Summit', 1),
        row('2020-11', 1, 'Harbor', 1),
        row('2020-12', 1, 'Harbor', 1),
      ],
      range,
    );

    assert.deepEqual(
      model.tableRows.map((r) => `${r.month} ${r.broker}`),
      ['2020-11 Harbor', '2020-12 Harbor', '2020-12 Summit', '2021-01 Harbor'],
    );
  });

  it('zero-fills months without listings and aligns every series with the labels', () => {
    const model = buildDashboardModel(
      [row('2021-03', 1, 'Harbor', 2), row('2021-05', 2, 'Summit', 5)],
      range,
    );

    for (const dataset of model.chart.datasets) {
      assert.equal(dataset.data.length, model.chart.labels.length);
    }
    assert.equal(model.chart.datasets.find((d) => d.label === 'Summit').data[6], 5);
    assert.equal(model.chart.datasets.find((d) => d.label === 'Harbor').data[6], 0);
  });

  it('keeps sites with the same title as separate series', () => {
    const model = buildDashboardModel(
      [row('2021-01', 1, 'Same Name', 1), row('2021-01', 2, 'Same Name', 2)],
      range,
    );

    assert.equal(model.chart.datasets.length, 2);
  });

  it('assigns deterministic colours', () => {
    const rows = [row('2021-01', 1, 'Harbor', 1), row('2021-01', 2, 'Summit', 1)];

    assert.deepEqual(
      buildDashboardModel(rows, range).chart.datasets.map((d) => d.borderColor),
      buildDashboardModel(rows, range).chart.datasets.map((d) => d.borderColor),
    );
  });

  it('formats average revenue with two decimals and handles missing values', () => {
    const model = buildDashboardModel(
      [row('2021-01', 1, 'Harbor', 1, '123456.5'), row('2021-01', 2, 'Summit', 1, null)],
      range,
    );

    assert.deepEqual(
      model.tableRows.map((r) => r.avgRevenue),
      ['123,456.50', '—'],
    );
  });
});
