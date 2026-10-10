-- Keep one owner-scoped policy per action; the removed policies were exact duplicates.
DROP POLICY IF EXISTS "Users can mark posts not interested" ON public.not_interested;
DROP POLICY IF EXISTS "Users can remove not interested marks" ON public.not_interested;
DROP POLICY IF EXISTS "Users can view their not interested posts" ON public.not_interested;
