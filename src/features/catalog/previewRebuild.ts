import { supabase } from "../../lib/supabase";

// Product pages are static files with their link-preview tags baked in at build time. After an
// admin save the server compares those tags with the database and rebuilds the site only when a
// preview actually changed (see api/rebuild-previews.mjs).
const REBUILD_ENDPOINT = "/api/rebuild-previews";
// Long enough for a burst of saves and for the cover's preview image to finish uploading.
const REBUILD_DELAY_MS = 20_000;

/** What the server answered; "error" covers a failed request or an unexpected reply. */
export type PreviewRebuildStatus = "up-to-date" | "building" | "rebuild-started" | "hook-missing" | "error";

let pendingTimer: number | null = null;
let accessToken: string | null = null;
let statusListener: ((status: PreviewRebuildStatus) => void) | null = null;

/** The admin page listens so a rebuild (or a setup problem) is visible instead of silent. */
export function onPreviewRebuildStatus(listener: ((status: PreviewRebuildStatus) => void) | null) {
  statusListener = listener;
}

const KNOWN_STATUSES: PreviewRebuildStatus[] = ["up-to-date", "building", "rebuild-started", "hook-missing"];

function send() {
  if (pendingTimer !== null) window.clearTimeout(pendingTimer);
  pendingTimer = null;
  if (!accessToken) return;
  // keepalive lets the request finish when it is flushed while the admin tab is closing.
  void fetch(REBUILD_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    keepalive: true,
  })
    .then((response) => response.json())
    .then(
      (body: { status?: string }) => KNOWN_STATUSES.find((status) => status === body.status) ?? "error",
      () => "error" as const,
    )
    .then((status) => statusListener?.(status));
}

/** Ask for a preview check shortly after the last save; repeated calls collapse into one. */
export function requestPreviewRebuild() {
  if (!supabase || import.meta.env.DEV) return;
  void supabase.auth.getSession().then(({ data }) => {
    accessToken = data.session?.access_token ?? null;
  });
  if (pendingTimer !== null) window.clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(send, REBUILD_DELAY_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (pendingTimer !== null) send();
  });
}
