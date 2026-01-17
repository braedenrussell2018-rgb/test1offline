-- Add policy for owners and developers to view all ai_conversations
CREATE POLICY "Owners and developers can view all conversations"
ON public.ai_conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'developer'::app_role)
);