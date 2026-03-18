/**
 * OfficeFeed — "All" tab showing curated summary of all agent interactions.
 *
 * Displays a Slack-like feed of:
 * - Meeting summaries (who met, what was discussed)
 * - Pair chat conversations (who talked, highlights)
 * - Activities (coffee runs, whiteboarding, code reviews)
 * - Status changes (agent started thinking, completed a task)
 *
 * Auto-scrolls, updates in real-time from the activity system.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { SvgAvatar } from "@/components/shared/SvgAvatar";
import { useOfficeStore } from "@/store/office-store";
import { getActivityState } from "@/hooks/useCasualRoaming";
import {
  type ActivityType,
  type Activity,
} from "@/lib/office-activities";
import {
  detectAgentRole,
  getDialogueForActivity,
} from "@/lib/agent-dialogue";

// ── Types ──

interface FeedEntry {
  id: string;
  timestamp: number;
  type: "interaction" | "activity" | "status" | "dialogue";
  icon: string;
  title: string;
  body: string;
  participants: string[]; // agent IDs
  activityType?: ActivityType;
}

// ── Constants ──

const MAX_FEED_ENTRIES = 100;
const ACTIVITY_LABELS: Record<ActivityType, { icon: string; label: string }> = {
  deskWork: { icon: "💻", label: "Working at desk" },
  coffeeRun: { icon: "☕", label: "Coffee break" },
  couchBreak: { icon: "🛋️", label: "Taking a break" },
  waterCooler: { icon: "🚰", label: "Water cooler chat" },
  meeting: { icon: "📋", label: "Team meeting" },
  pairChat: { icon: "💬", label: "Quick chat" },
  phoneCalling: { icon: "📱", label: "Phone call" },
  whiteboarding: { icon: "📝", label: "Whiteboarding session" },
  lunchBreak: { icon: "🍽️", label: "Lunch break" },
  stretching: { icon: "🧘", label: "Stretching break" },
  presentationMode: { icon: "📊", label: "Presentation" },
  codeReview: { icon: "👀", label: "Code review" },
};

// ── Feed State (singleton) ──

let feedEntries: FeedEntry[] = [];
let entryCounter = 0;
let lastActivitySnapshot: Set<string> = new Set();
let lastStatusSnapshot: Map<string, string> = new Map();

function addEntry(entry: Omit<FeedEntry, "id" | "timestamp">) {
  const newEntry: FeedEntry = {
    ...entry,
    id: `feed_${++entryCounter}`,
    timestamp: Date.now(),
  };
  feedEntries.push(newEntry);
  if (feedEntries.length > MAX_FEED_ENTRIES) {
    feedEntries = feedEntries.slice(-MAX_FEED_ENTRIES);
  }
}

function getAgentName(agentId: string): string {
  const agent = useOfficeStore.getState().agents.get(agentId);
  return agent?.name ?? agentId;
}

function getAgentNames(ids: string[]): string {
  if (ids.length === 0) return "";
  if (ids.length === 1) return getAgentName(ids[0]);
  if (ids.length === 2) return `${getAgentName(ids[0])} & ${getAgentName(ids[1])}`;
  return `${getAgentName(ids[0])}, ${getAgentName(ids[1])} +${ids.length - 2}`;
}

function generateActivitySummary(act: Activity, agents: Map<string, import("@/gateway/types").VisualAgent>): string {
  const names = act.participants.map((id) => getAgentName(id));
  const meta = ACTIVITY_LABELS[act.type] ?? { icon: "📌", label: act.type };

  switch (act.type) {
    case "meeting":
    case "presentationMode": {
      // Generate a meeting summary with dialogue snippets
      const snippets: string[] = [];
      for (const pid of act.participants.slice(0, 3)) {
        const agent = agents.get(pid);
        if (agent) {
          const line = getDialogueForActivity(act.type, `feed_${act.type}_${pid}`, agent);
          if (line) snippets.push(`**${agent.name}:** "${line}"`);
        }
      }
      return snippets.length > 0
        ? snippets.join("\n")
        : `${names.join(", ")} gathered for a ${meta.label.toLowerCase()}.`;
    }
    case "pairChat":
    case "waterCooler": {
      const a = agents.get(act.participants[0]);
      const b = agents.get(act.participants[1]);
      if (a && b) {
        const roleA = detectAgentRole(a);
        const roleB = detectAgentRole(b);
        const lineA = getDialogueForActivity(act.type, `feed_a_${a.id}`, a, b);
        const lineB = getDialogueForActivity(act.type, `feed_b_${b.id}`, b, a);
        const lines: string[] = [];
        if (lineA) lines.push(`**${a.name}:** "${lineA}"`);
        if (lineB) lines.push(`**${b.name}:** "${lineB}"`);
        if (lines.length > 0) return lines.join("\n");
        return `${a.name} (${roleA}) and ${b.name} (${roleB}) had a conversation.`;
      }
      return `${names.join(" & ")} chatted.`;
    }
    case "codeReview": {
      const reviewer = agents.get(act.participants[0]);
      const author = agents.get(act.participants[1]);
      if (reviewer && author) {
        return `**${reviewer.name}** reviewed code with **${author.name}**`;
      }
      return `${names.join(" & ")} did a code review.`;
    }
    case "whiteboarding": {
      return `${names.join(", ")} had a whiteboarding session discussing architecture.`;
    }
    case "coffeeRun":
      return `Grabbed a coffee.`;
    case "couchBreak":
      return `Taking a quick break on the couch.`;
    case "lunchBreak":
      return `Headed out for lunch.`;
    case "phoneCalling": {
      const agent = agents.get(act.participants[0]);
      const role = agent ? detectAgentRole(agent) : "generic";
      const context = role === "ceo" ? "investor sync" : role === "pm" ? "stakeholder call" : "quick sync";
      return `On a ${context}.`;
    }
    case "stretching":
      return `Quick desk stretch.`;
    default:
      return `${names.join(", ")} — ${meta.label}.`;
  }
}

// ── Tick function — call periodically to detect new activities ──

export function tickFeed() {
  const actState = getActivityState();
  if (!actState) return;

  const agents = useOfficeStore.getState().agents;
  const currentActivityIds = new Set(actState.activities.keys());

  // Detect NEW activities (not in last snapshot)
  for (const [actId, act] of actState.activities) {
    if (!lastActivitySnapshot.has(actId) && act.phase !== "returning") {
      const meta = ACTIVITY_LABELS[act.type] ?? { icon: "📌", label: act.type };
      const summary = generateActivitySummary(act, agents);

      addEntry({
        type: act.participants.length > 1 ? "interaction" : "activity",
        icon: meta.icon,
        title: `${meta.icon} ${getAgentNames(act.participants)} — ${meta.label}`,
        body: summary,
        participants: [...act.participants],
        activityType: act.type,
      });
    }
  }

  // Detect completed activities
  for (const oldId of lastActivitySnapshot) {
    if (!currentActivityIds.has(oldId)) {
      // Activity ended — could add a "completed" entry here if needed
    }
  }

  lastActivitySnapshot = currentActivityIds;

  // Detect status changes (agent started working, etc.)
  for (const [agentId, agent] of agents) {
    if (agent.isPlaceholder || agent.isSubAgent) continue;
    const prevStatus = lastStatusSnapshot.get(agentId);
    if (prevStatus && prevStatus !== agent.status) {
      if (agent.status === "thinking") {
        addEntry({
          type: "status",
          icon: "💭",
          title: `${agent.name} started thinking`,
          body: agent.currentTool ? `Working with ${agent.currentTool.name}` : "Processing...",
          participants: [agentId],
        });
      } else if (agent.status === "speaking" && agent.speechBubble?.text) {
        const text = agent.speechBubble.text;
        const truncated = text.length > 120 ? text.slice(0, 117) + "..." : text;
        addEntry({
          type: "status",
          icon: "💬",
          title: `${agent.name} is responding`,
          body: truncated,
          participants: [agentId],
        });
      } else if (prevStatus === "thinking" && agent.status === "idle") {
        addEntry({
          type: "status",
          icon: "✅",
          title: `${agent.name} finished task`,
          body: "Back to idle.",
          participants: [agentId],
        });
      }
    }
    lastStatusSnapshot.set(agentId, agent.status);
  }
}

// ── React Component ──

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function FeedEntryCard({ entry }: { entry: FeedEntry }) {
  const primaryAgent = entry.participants[0];

  return (
    <div className="flex gap-2.5 px-3 py-2 hover:bg-[#1a1a2e]/50">
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        {primaryAgent ? (
          <SvgAvatar agentId={primaryAgent} size={24} />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2a42] text-xs">
            {entry.icon}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold text-gray-200">
            {entry.title}
          </span>
          <span className="shrink-0 text-[9px] text-gray-500">
            {formatTime(entry.timestamp)}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] leading-relaxed text-gray-400 whitespace-pre-line">
          {entry.body.split("**").map((part, i) =>
            i % 2 === 1 ? (
              <span key={i} className="font-semibold text-gray-300">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export function OfficeFeed() {
  const [, forceUpdate] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Tick the feed and re-render periodically
  useEffect(() => {
    const interval = setInterval(() => {
      tickFeed();
      forceUpdate((n) => n + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feedEntries.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  return (
    <div className="relative flex h-full flex-col">
      {/* Feed entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {feedEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div>
              <div className="text-2xl">🏢</div>
              <div className="mt-2 text-xs text-gray-500">
                Office feed will populate as agents interact...
              </div>
              <div className="mt-1 text-[10px] text-gray-600">
                Meetings, chats, coffee breaks, and status updates appear here.
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a2e]/50 py-1">
            {feedEntries.map((entry) => (
              <FeedEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Scroll to bottom */}
      {!autoScroll && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-2 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#2a2a42] bg-[#13132a] shadow-md hover:bg-[#1a1a2e]"
        >
          <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      )}
    </div>
  );
}
