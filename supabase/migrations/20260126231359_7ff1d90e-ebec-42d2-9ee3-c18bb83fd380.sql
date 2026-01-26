-- Enable pgcrypto extension (required for digest function used in signup triggers)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;