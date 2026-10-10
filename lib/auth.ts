"use client";
import { createClient } from "@/lib/supabase/client";
import { browserStorage, clearFeedCache } from "@/lib/feed-cache";
export async function signOut(){clearFeedCache(browserStorage());await createClient().auth.signOut();window.location.href="/auth";}