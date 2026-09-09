// Calling `.toLocaleString()` without a locale uses whatever locale the current runtime
// happens to have, which can differ between the Node server and the browser, causing the
// server-rendered and client-rendered text to mismatch. Pinning a locale here keeps the
// output identical in both places.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
