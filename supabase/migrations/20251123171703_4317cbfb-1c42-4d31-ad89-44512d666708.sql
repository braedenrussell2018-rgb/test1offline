-- Rename estimates table to quotes
ALTER TABLE estimates RENAME TO quotes;

-- Rename columns to match quote terminology
ALTER TABLE quotes RENAME COLUMN estimate_number TO quote_number;