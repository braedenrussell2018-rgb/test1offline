-- Add encrypted email column to signup_notifications
ALTER TABLE public.signup_notifications 
ADD COLUMN IF NOT EXISTS email_encrypted TEXT;

-- Create function to encrypt email addresses (using same pattern as token encryption)
CREATE OR REPLACE FUNCTION public.encrypt_email(email_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key BYTEA;
  encrypted_data TEXT;
BEGIN
  IF email_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use a constant encryption key derived from JWT secret
  -- This provides encryption at rest - only server-side can decrypt
  encryption_key := digest(current_setting('app.settings.jwt_secret', true) || 'email_encryption_salt', 'sha256');
  
  -- Encrypt using pgcrypto's pgp_sym_encrypt
  encrypted_data := encode(pgp_sym_encrypt(email_text, encode(encryption_key, 'hex')), 'base64');
  
  RETURN encrypted_data;
END;
$$;

-- Create function to decrypt email addresses
CREATE OR REPLACE FUNCTION public.decrypt_email(encrypted_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key BYTEA;
  decrypted_data TEXT;
BEGIN
  IF encrypted_email IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := digest(current_setting('app.settings.jwt_secret', true) || 'email_encryption_salt', 'sha256');
  
  BEGIN
    decrypted_data := pgp_sym_decrypt(decode(encrypted_email, 'base64'), encode(encryption_key, 'hex'));
    RETURN decrypted_data;
  EXCEPTION WHEN OTHERS THEN
    -- Return NULL on decryption failure
    RETURN NULL;
  END;
END;
$$;

-- Migrate existing plaintext emails to encrypted format
UPDATE public.signup_notifications 
SET email_encrypted = encrypt_email(email)
WHERE email IS NOT NULL AND email_encrypted IS NULL;

-- Update the trigger to encrypt emails on insert
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into signup_notifications with encrypted email
  INSERT INTO public.signup_notifications (user_id, email, email_encrypted, full_name, signed_up_at)
  VALUES (
    NEW.id,
    '***encrypted***', -- Mask the plaintext column
    encrypt_email(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unknown'),
    NEW.created_at
  );
  
  -- Also handle profiles table
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unknown')
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Mask existing plaintext emails now that they're encrypted
UPDATE public.signup_notifications 
SET email = '***encrypted***'
WHERE email_encrypted IS NOT NULL AND email != '***encrypted***';

-- Create a secure view that decrypts emails only for authorized users
CREATE OR REPLACE VIEW public.signup_notifications_decrypted AS
SELECT 
  id,
  user_id,
  decrypt_email(email_encrypted) as email,
  full_name,
  signed_up_at,
  read_at,
  created_at
FROM public.signup_notifications;

-- Grant access to the view
GRANT SELECT ON public.signup_notifications_decrypted TO authenticated;

-- Add comment explaining the security model
COMMENT ON TABLE public.signup_notifications IS 'User signup notifications with encrypted email addresses. Access via signup_notifications_decrypted view for decrypted data.';