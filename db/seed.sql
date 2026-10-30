-- Deterministic, fictional sample data spanning Sep 2020 – Jan 2022.
-- November appears in two different years so year-aware monthly buckets are visible.

TRUNCATE deals, sites RESTART IDENTITY;

INSERT INTO sites (id, title) VALUES
  (1, 'Harbor Business Brokers'),
  (2, 'Summit Acquisitions'),
  (3, 'Northwind Listings');

INSERT INTO deals (site_id, listing_date, revenue)
SELECT s.id,
       day::date,
       (50000 + ((EXTRACT(DOY FROM day)::int * 37 + s.id * 101) % 200) * 1250)::numeric(14,2)
  FROM sites s
 CROSS JOIN generate_series(date '2020-09-01', date '2022-01-31', interval '1 day') AS day
 WHERE (EXTRACT(DOY FROM day)::int + EXTRACT(YEAR FROM day)::int * s.id) % (4 + s.id) = 0;
