-- Drop existing overly permissive RLS policies on quotes
DROP POLICY IF EXISTS "Authenticated users can view all estimates" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can insert estimates" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can update estimates" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can delete estimates" ON quotes;

-- Create restrictive policies - users can only access quotes they created (matched by salesman_name)
CREATE POLICY "Users can view their own quotes" ON quotes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can insert their own quotes" ON quotes
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own quotes" ON quotes
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can delete their own quotes" ON quotes
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    salesman_name = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
  )
);