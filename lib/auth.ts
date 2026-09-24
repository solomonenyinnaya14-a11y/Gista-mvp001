"use client";
import { createClient } from "@/lib/supabase/client";
export async function signOut(){await createClient().auth.signOut();window.location.href="/auth";}