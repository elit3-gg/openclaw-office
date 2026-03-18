/**
 * Agent Dialogue System
 * 
 * Generates contextual speech bubble messages for agents during activities.
 * Messages rotate to give the office a lively, conversational feel.
 */

import type { ActivityType } from "./office-activities";

// ── Dialogue pools for each activity ──

const MEETING_DIALOGUES = [
  "Let's align on the sprint goals",
  "I think we should refactor the auth module",
  "Good point, what about edge cases?",
  "Can we circle back on that?",
  "Let's take this offline",
  "What's the timeline looking like?",
  "Do we have any blockers?",
  "Who's taking the action item?",
  "We should document this decision",
  "Great progress everyone! 🎉",
  "Any concerns before we proceed?",
  "Let me share my screen...",
  "The metrics look promising",
  "We need more test coverage",
  "This aligns with our OKRs",
];

const COFFEE_DIALOGUES = [
  "Need caffeine ☕",
  "Quick coffee break",
  "Mmm, fresh brew",
  "Third cup today...",
  "Coffee time!",
  "☕ Refuel time",
  "Much needed break",
  "The good stuff ✨",
  "Best part of the day",
  "Espresso please",
];

const PAIR_CHAT_DIALOGUES = [
  "Hey, got a minute?",
  "What do you think about this approach?",
  "Quick question for you",
  "Have you seen the latest PR?",
  "That's a great idea!",
  "I was thinking the same thing",
  "Let me show you something",
  "Interesting perspective",
  "That makes sense",
  "We should sync more often",
  "How's your day going?",
  "Did you see the announcement?",
];

const WHITEBOARDING_DIALOGUES = [
  "So the data flows like this...",
  "What if we add a cache layer?",
  "Here's the architecture",
  "This connects to that service",
  "Let me draw it out",
  "We could optimize here",
  "Does this make sense?",
  "And this is the API contract",
  "The bottleneck is here",
  "This is the happy path",
  "Edge case: what if...",
  "We need error handling here",
];

const CODE_REVIEW_DIALOGUES = [
  "This looks clean 👍",
  "Found a potential issue here",
  "Nice refactor!",
  "What about null checks?",
  "Consider extracting this",
  "Good test coverage",
  "This could be more DRY",
  "The naming is clear",
  "Small nit: formatting",
  "LGTM! ✅",
  "Have you tried...?",
  "This is elegant",
];

const PHONE_DIALOGUES = [
  "📱 Yes, I understand",
  "📱 Let me check on that",
  "📱 Sounds good",
  "📱 I'll follow up",
  "📱 One moment please",
  "📱 Absolutely",
  "📱 I'll send that over",
  "📱 Thanks for calling",
  "📱 Got it, will do",
  "📱 Talk soon!",
];

const PRESENTATION_DIALOGUES = [
  "Next slide please...",
  "As you can see here...",
  "Let me walk you through this",
  "Any questions so far?",
  "Moving on to...",
  "This is really exciting!",
  "Key takeaway here is...",
  "Building on that point...",
  "In summary...",
  "Let's dive deeper",
];

const STRETCHING_DIALOGUES = [
  "🧘 Stretch break",
  "Been sitting too long",
  "💪 Quick stretch",
  "Gotta move around",
  "Break time!",
  "*stretches*",
  "Ahh, that's better",
  "Need to move more",
];

const COUCH_DIALOGUES = [
  "🛋️ Quick rest",
  "Taking five",
  "Brain break",
  "Recharging...",
  "Comfy spot",
  "Just a moment...",
  "Nice and cozy",
];

const WATER_COOLER_DIALOGUES = [
  "Did you catch the game?",
  "How was your weekend?",
  "Staying hydrated 💧",
  "Any plans later?",
  "Weather's nice today",
  "Quick water break",
  "So, what's new?",
  "Have you tried that new place?",
];

const LUNCH_DIALOGUES = [
  "🍽️ Lunch time!",
  "Be back in a bit",
  "Off to grab food",
  "Stepping out",
  "Need some fresh air",
];

// ── Activity to dialogue pool mapping ──

const DIALOGUE_POOLS: Partial<Record<ActivityType, string[]>> = {
  meeting: MEETING_DIALOGUES,
  coffeeRun: COFFEE_DIALOGUES,
  pairChat: PAIR_CHAT_DIALOGUES,
  whiteboarding: WHITEBOARDING_DIALOGUES,
  codeReview: CODE_REVIEW_DIALOGUES,
  phoneCalling: PHONE_DIALOGUES,
  presentationMode: PRESENTATION_DIALOGUES,
  stretching: STRETCHING_DIALOGUES,
  couchBreak: COUCH_DIALOGUES,
  waterCooler: WATER_COOLER_DIALOGUES,
  lunchBreak: LUNCH_DIALOGUES,
};

// ── Dialogue state tracking ──

interface DialogueState {
  lastDialogueIndex: Map<string, number>;  // activityId -> last used index
  dialogueTimers: Map<string, number>;      // agentId -> time until next dialogue
}

const dialogueState: DialogueState = {
  lastDialogueIndex: new Map(),
  dialogueTimers: new Map(),
};

// ── Public API ──

/**
 * Get a random dialogue for the given activity type.
 * Avoids repeating the same dialogue consecutively.
 */
export function getDialogueForActivity(
  activityType: ActivityType,
  activityId: string,
): string | null {
  const pool = DIALOGUE_POOLS[activityType];
  if (!pool || pool.length === 0) return null;

  const lastIndex = dialogueState.lastDialogueIndex.get(activityId) ?? -1;
  let newIndex = Math.floor(Math.random() * pool.length);
  
  // Avoid repeating the same dialogue
  if (pool.length > 1 && newIndex === lastIndex) {
    newIndex = (newIndex + 1) % pool.length;
  }
  
  dialogueState.lastDialogueIndex.set(activityId, newIndex);
  return pool[newIndex];
}

/**
 * Check if an agent should display a new dialogue.
 * Returns true approximately every 3-5 seconds during activities.
 */
export function shouldShowDialogue(agentId: string, dt: number): boolean {
  let timer = dialogueState.dialogueTimers.get(agentId) ?? 0;
  timer -= dt;
  
  if (timer <= 0) {
    // Reset timer with some randomness
    timer = 3 + Math.random() * 2;
    dialogueState.dialogueTimers.set(agentId, timer);
    return true;
  }
  
  dialogueState.dialogueTimers.set(agentId, timer);
  return false;
}

/**
 * Get the dialogue probability based on activity type.
 * Some activities (like phone calls) should show dialogue more often.
 */
export function getDialogueProbability(activityType: ActivityType): number {
  switch (activityType) {
    case "phoneCalling":
    case "presentationMode":
      return 0.8;
    case "meeting":
    case "pairChat":
    case "whiteboarding":
    case "codeReview":
      return 0.6;
    case "coffeeRun":
    case "stretching":
      return 0.3;
    case "couchBreak":
    case "waterCooler":
      return 0.4;
    case "lunchBreak":
      return 0.2;
    default:
      return 0.3;
  }
}

/**
 * Clean up dialogue state for completed activities.
 */
export function clearDialogueState(activityId: string): void {
  dialogueState.lastDialogueIndex.delete(activityId);
}

/**
 * Reset all dialogue timers (e.g., when scene changes).
 */
export function resetDialogueTimers(): void {
  dialogueState.dialogueTimers.clear();
}

// ── Export dialogue pools for testing ──

export const DIALOGUES = {
  meeting: MEETING_DIALOGUES,
  coffeeRun: COFFEE_DIALOGUES,
  pairChat: PAIR_CHAT_DIALOGUES,
  whiteboarding: WHITEBOARDING_DIALOGUES,
  codeReview: CODE_REVIEW_DIALOGUES,
  phoneCalling: PHONE_DIALOGUES,
  presentationMode: PRESENTATION_DIALOGUES,
  stretching: STRETCHING_DIALOGUES,
  couchBreak: COUCH_DIALOGUES,
  waterCooler: WATER_COOLER_DIALOGUES,
  lunchBreak: LUNCH_DIALOGUES,
};
