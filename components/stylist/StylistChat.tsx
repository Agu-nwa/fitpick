"use client";

import { useEffect, useState } from "react";

export function StylistChat() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ✅ FIX: prevent SSR hydration mismatch / early render issues
  useEffect(() => {
    setHydrated(true);
  }, []);

  async function askStylist() {
    if (!message.trim()) return;

    setLoading(true);
    setReply(""); // clear previous reply

    try {
      const response = await fetch("/api/stylist/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      });

      const data = await response.json();

      setReply(
        data.data?.reply ||
          "No recommendation available."
      );
    } catch (err) {
      console.error("Stylist error:", err);

      setReply("Unable to reach AI Stylist.");
    }

    setLoading(false);
  }

  // ✅ FIX: prevent blank / broken first render
  if (!hydrated) {
    return <div className="p-4 text-gray-400">Loading FitPick Stylist...</div>;
  }

  return (
    <div className="space-y-4">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask FitPick what to wear..."
        className="w-full rounded-lg border p-4"
      />

      <button
        onClick={askStylist}
        disabled={loading}
        className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Thinking..." : "Ask Stylist"}
      </button>

      {/* ✅ FIX: better empty + loading UX */}
      {loading && (
        <div className="rounded-lg border p-4 text-gray-500">
          Styling your outfit...
        </div>
      )}

      {!loading && reply && (
        <div className="rounded-lg border p-4">
          <h3 className="font-bold mb-2">FitPick Stylist</h3>
          <p className="whitespace-pre-wrap">{reply}</p>
        </div>
      )}
    </div>
  );
}
