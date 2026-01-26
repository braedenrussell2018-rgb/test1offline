-- Drop the extension from extensions schema if it exists there
DROP EXTENSION IF EXISTS pgcrypto CASCADE;

-- Enable pgcrypto extension in the public schema so digest() function is accessible
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;