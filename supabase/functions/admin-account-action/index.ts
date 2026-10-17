import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(401, { error: "Sign in as a Gista administrator first." });

  const url = Deno.env.get("SUPABASE_URL");
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const anonKey = publishable ? JSON.parse(publishable).default : Deno.env.get("SUPABASE_ANON_KEY");
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const serviceKey = secretKeys ? JSON.parse(secretKeys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "Server authentication is not configured." });

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return reply(401, { error: "Your session could not be verified. Sign in again." });

  const { data: callerAdmin, error: callerAdminError } = await callerClient
    .from("gista_admins").select("role").eq("user_id", caller.id).maybeSingle();
  if (callerAdminError || !callerAdmin || !["owner", "admin"].includes(callerAdmin.role)) {
    return reply(403, { error: "Only authorised Gista administrators can take account actions." });
  }

  let input: { target_profile_id?: string; action?: string; reason?: string };
  try { input = await req.json(); } catch { return reply(400, { error: "Invalid request body." }); }
  const targetId = input.target_profile_id?.trim();
  const action = input.action;
  const reason = input.reason?.trim() ?? "";
  if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
    return reply(400, { error: "Choose a valid Gista account." });
  }
  if (!["suspend", "ban", "restore"].includes(action ?? "")) return reply(400, { error: "Choose a valid account action." });
  if (reason.length < 5 || reason.length > 3000) return reply(400, { error: "Enter a reason of at least 5 characters (maximum 3000)." });
  if (targetId === caller.id) return reply(400, { error: "You cannot suspend or ban your own administrator account." });

  const admin = createClient(url, serviceKey);
  const { data: targetProfile, error: profileError } = await admin
    .from("profiles").select("id").eq("id", targetId).maybeSingle();
  if (profileError || !targetProfile) return reply(404, { error: "Gista account not found." });

  const { data: targetAdmin, error: targetAdminError } = await admin
    .from("gista_admins").select("role").eq("user_id", targetId).maybeSingle();
  if (targetAdminError) return reply(500, { error: "Could not verify the target account's admin role." });
  if (targetAdmin?.role === "owner") return reply(403, { error: "The founder/owner account is protected from account enforcement." });
  if (targetAdmin && callerAdmin.role !== "owner") return reply(403, { error: "Only the owner can take account actions against another administrator." });

  const banDuration = action === "suspend" ? "720h" : action === "ban" ? "876000h" : "none";
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: banDuration });
  if (authUpdateError) return reply(500, { error: "Supabase could not update sign-in access: " + authUpdateError.message });

  const state = action === "restore" ? "active" : action === "suspend" ? "suspended" : "banned";
  const now = new Date().toISOString();
  const { error: stateError } = await admin.from("account_moderation_state").upsert({
    profile_id: targetId, status: state, reason, changed_by: caller.id, changed_at: now,
  }, { onConflict: "profile_id" });
  const { error: auditError } = await admin.from("account_moderation_actions").insert({
    profile_id: targetId, actor_id: caller.id, action, reason,
  });

  if (stateError || auditError) {
    return reply(500, {
      error: "Sign-in access was updated, but the moderation audit could not be fully saved. Please check the admin database logs before repeating this action.",
      access_updated: true,
      state_error: stateError?.message ?? null,
      audit_error: auditError?.message ?? null,
    });
  }
  return reply(200, { ok: true, action, status: state, target_profile_id: targetId });
});
