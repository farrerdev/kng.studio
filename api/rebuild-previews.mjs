// Called by the admin after a save. Product pages are static files baked at build time, so when a
// save changes any link-preview tag (title, price, cover image, a product added or removed) the site
// has to be rebuilt. This compares the live build's signature with the database and triggers the
// Vercel deploy hook only when they differ: edits that don't touch a preview never cause a deploy.
import { buildPreviewEntries, fetchPreviewCatalog, getPreviewSignature } from "../lib/productPreview.mjs";

const REQUEST_TIMEOUT_MS = 4000;

// A warm instance remembers what it already asked Vercel to build, so repeated saves during the
// minute a build takes don't queue a deploy each.
let lastRequestedSignature = null;

export async function POST(request) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL ?? "";
  if (!supabaseUrl || !supabaseAnonKey) return json({ status: "not-configured" }, 503);

  if (!(await isSignedInAdmin(request, supabaseUrl, supabaseAnonKey))) {
    return json({ status: "unauthorized" }, 401);
  }

  try {
    const catalog = await fetchPreviewCatalog(supabaseUrl, supabaseAnonKey);
    const signature = getPreviewSignature(await buildPreviewEntries(supabaseUrl, catalog));
    const liveSignature = await fetchLiveSignature(new URL(request.url).origin);

    if (signature === liveSignature) return json({ status: "up-to-date" });
    if (signature === lastRequestedSignature) return json({ status: "building" });
    if (!deployHookUrl) return json({ status: "hook-missing" });

    const response = await fetch(deployHookUrl, { method: "POST", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Deploy hook answered ${response.status}`);
    lastRequestedSignature = signature;
    return json({ status: "rebuild-started" });
  } catch (error) {
    console.error("Preview rebuild check failed", error);
    return json({ status: "failed" }, 500);
  }
}

// Admin accounts are the only Supabase users (see the "Authenticated admin" policies), so a valid
// session token is the same check the database applies to catalog writes.
async function isSignedInAdmin(request, supabaseUrl, supabaseAnonKey) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization)) return false;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, authorization },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchLiveSignature(origin) {
  try {
    const response = await fetch(`${origin}/preview-signature.json`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return null;
    return (await response.json()).signature ?? null;
  } catch {
    return null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
