"use client";

import { useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/formatDate";

const ACTOR_STYLES: Record<string, string> = {
  system: "bg-neutral-100 text-neutral-700 border-neutral-300",
  ai: "bg-purple-100 text-purple-800 border-purple-300",
  trader: "bg-blue-100 text-blue-800 border-blue-300",
};

export function AuditLogTable({ entries }: { entries: AuditEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const lowerQuery = query.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.actor.includes(lowerQuery) ||
        entry.eventType.toLowerCase().includes(lowerQuery) ||
        (entry.candidateId ?? "").toLowerCase().includes(lowerQuery) ||
        JSON.stringify(entry.details).toLowerCase().includes(lowerQuery)
    );
  }, [entries, query]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by actor, event type, candidate id, or any detail…"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-800">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Candidate</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-neutral-100 last:border-0 align-top">
                <td className="px-4 py-2 text-neutral-800 whitespace-nowrap">{formatDateTime(entry.ts)}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ACTOR_STYLES[entry.actor]}`}>
                    {entry.actor}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{entry.eventType}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-800">{entry.candidateId ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-neutral-900 max-w-md">
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(entry.details, null, 0)}</pre>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-800">
                  No audit entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
