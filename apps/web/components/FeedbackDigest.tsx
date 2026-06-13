"use client";
import { useState } from "react";
import { getFeedbackForEvent } from "@talentbank/firebase-config";
import { Sparkles, RefreshCw } from "lucide-react";

interface DigestResult {
  summary: string;
  themes: string[];
  sentiment: "positive" | "mixed" | "negative";
  actionItems: string[];
}

const SENTIMENT_CONFIG = {
  positive: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Positive",
  },
  mixed: { bg: "bg-amber-100", text: "text-amber-700", label: "Mixed" },
  negative: { bg: "bg-red-100", text: "text-red-600", label: "Negative" },
};

export default function FeedbackDigest({ eventId }: { eventId: string }) {
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const feedbackList = await getFeedbackForEvent(eventId);
      setCount(feedbackList.length);
      const res = await fetch("/api/ai/feedback-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackList }),
      });
      const data = await res.json();
      setDigest(data);
    } finally {
      setLoading(false);
    }
  };

  const sentimentStyle = digest
    ? SENTIMENT_CONFIG[digest.sentiment]
    : null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          Feedback Digest
          {count !== null && (
            <span className="text-xs font-normal text-gray-400">
              ({count} response{count !== 1 ? "s" : ""})
            </span>
          )}
        </h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 bg-amber-400 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-amber-500 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Analysing..." : "Generate AI Digest"}
        </button>
      </div>

      {!digest && !loading && (
        <p className="text-gray-400 text-sm text-center py-4">
          Click &quot;Generate AI Digest&quot; to summarise student feedback for this event.
        </p>
      )}

      {digest && (
        <div className="flex flex-col gap-4">
          {/* Sentiment */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sentiment:</span>
            {sentimentStyle && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentStyle.bg} ${sentimentStyle.text}`}
              >
                {sentimentStyle.label}
              </span>
            )}
          </div>

          {/* Summary */}
          {digest.summary && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {digest.summary}
            </p>
          )}

          {/* Themes */}
          {digest.themes.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Key Themes</p>
              <div className="flex flex-wrap gap-2">
                {digest.themes.map((theme, i) => (
                  <span
                    key={i}
                    className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {digest.actionItems.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Action Items</p>
              <ul className="flex flex-col gap-1.5">
                {digest.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
