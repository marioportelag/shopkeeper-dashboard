-- Minimal schema required by the dashboard query.
-- Reconstructed from the application's SQL; the original project did not ship one.

CREATE TABLE IF NOT EXISTS sites (
  id    integer PRIMARY KEY,
  title text    NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id           bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id      integer       NOT NULL REFERENCES sites (id),
  listing_date date          NOT NULL,
  revenue      numeric(14,2)
);

CREATE INDEX IF NOT EXISTS deals_listing_date_idx ON deals (listing_date);
