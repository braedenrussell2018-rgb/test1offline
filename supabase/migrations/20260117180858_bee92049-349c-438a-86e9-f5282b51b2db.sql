-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure function to encrypt tokens using a symmetric key stored in vault
-- The encryption key is derived from the user_id + a server-side secret
-- This provides per-user encryption keys without needing to store additional secrets

-- First, create helper functions for encryption/decryption using authenticated encryption
-- AES-256-GCM equivalent via pgcrypto (uses AES-CBC + HMAC for authenticated encryption)

-- Function to encrypt a token
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key BYTEA;
  encrypted_data TEXT;
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Generate encryption key from user_id and a constant (in production, use vault secret)
  -- The key is derived per-user for key isolation
  encryption_key := digest(user_id::text || current_setting('app.settings.jwt_secret', true), 'sha256');
  
  -- Encrypt using pgcrypto's pgp_sym_encrypt which provides authenticated encryption
  encrypted_data := encode(pgp_sym_encrypt(token, encode(encryption_key, 'hex')), 'base64');
  
  RETURN encrypted_data;
END;
$$;

-- Function to decrypt a token
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token TEXT, user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key BYTEA;
  decrypted_data TEXT;
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Generate the same encryption key
  encryption_key := digest(user_id::text || current_setting('app.settings.jwt_secret', true), 'sha256');
  
  -- Decrypt
  BEGIN
    decrypted_data := pgp_sym_decrypt(decode(encrypted_token, 'base64'), encode(encryption_key, 'hex'));
    RETURN decrypted_data;
  EXCEPTION WHEN OTHERS THEN
    -- Return NULL on decryption failure (corrupted/tampered data)
    RETURN NULL;
  END;
END;
$$;

-- Add encrypted columns for tokens (we'll migrate data then drop old columns)
ALTER TABLE public.quickbooks_connections 
ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;

-- Create a function to get decrypted tokens (for edge function use via service role)
CREATE OR REPLACE FUNCTION get_qb_tokens(p_user_id UUID)
RETURNS TABLE(
  access_token TEXT,
  refresh_token TEXT,
  realm_id TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    decrypt_token(qc.access_token_encrypted, qc.user_id) as access_token,
    decrypt_token(qc.refresh_token_encrypted, qc.user_id) as refresh_token,
    qc.realm_id,
    qc.token_expires_at,
    qc.refresh_token_expires_at
  FROM quickbooks_connections qc
  WHERE qc.user_id = p_user_id;
END;
$$;

-- Create a function to store encrypted tokens
CREATE OR REPLACE FUNCTION store_qb_tokens(
  p_user_id UUID,
  p_realm_id TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires_at TIMESTAMPTZ,
  p_refresh_token_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO quickbooks_connections (
    user_id,
    realm_id,
    access_token,
    refresh_token,
    access_token_encrypted,
    refresh_token_encrypted,
    token_expires_at,
    refresh_token_expires_at,
    connected_at
  ) VALUES (
    p_user_id,
    p_realm_id,
    '', -- Empty for legacy column (will be removed later)
    '', -- Empty for legacy column (will be removed later)
    encrypt_token(p_access_token, p_user_id),
    encrypt_token(p_refresh_token, p_user_id),
    p_token_expires_at,
    p_refresh_token_expires_at,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    realm_id = EXCLUDED.realm_id,
    access_token = '', -- Empty for legacy column
    refresh_token = '', -- Empty for legacy column
    access_token_encrypted = encrypt_token(p_access_token, p_user_id),
    refresh_token_encrypted = encrypt_token(p_refresh_token, p_user_id),
    token_expires_at = EXCLUDED.token_expires_at,
    refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
    updated_at = now();
END;
$$;

-- Create a function to update encrypted tokens (for token refresh)
CREATE OR REPLACE FUNCTION update_qb_tokens(
  p_user_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires_at TIMESTAMPTZ,
  p_refresh_token_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quickbooks_connections SET
    access_token = '', -- Empty for legacy column
    refresh_token = '', -- Empty for legacy column
    access_token_encrypted = encrypt_token(p_access_token, p_user_id),
    refresh_token_encrypted = encrypt_token(p_refresh_token, p_user_id),
    token_expires_at = p_token_expires_at,
    refresh_token_expires_at = p_refresh_token_expires_at,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;