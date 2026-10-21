-- Broadcast response changes so feed cards can keep their comment counts current.
-- FULL replica identity ensures DELETE events include post_id for count reconciliation.
ALTER TABLE public.responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;
