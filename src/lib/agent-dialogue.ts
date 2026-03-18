/**
 * Agent Dialogue System — Role-Aware & Context-Sensitive
 * 
 * Generates contextual speech bubble messages for agents during activities.
 * Messages are based on agent roles, recent activity, and interaction pairs.
 */

import type { ActivityType } from "./office-activities";
import type { VisualAgent, ToolCallRecord } from "@/gateway/types";

// ── Role Detection ──

export type AgentRole = 
  | "ceo" 
  | "pm" 
  | "eng-lead" 
  | "architect" 
  | "coder" 
  | "qa" 
  | "designer" 
  | "devops" 
  | "data"
  | "support"
  | "generic";

/**
 * Detect agent role from their name/id.
 * Common patterns: "ceo", "eng-lead", "architect", "coder", "qa", etc.
 */
export function detectAgentRole(agent: VisualAgent): AgentRole {
  const nameId = (agent.name + " " + agent.id).toLowerCase();
  
  if (nameId.includes("ceo") || nameId.includes("chief") || nameId.includes("founder")) {
    return "ceo";
  }
  if (nameId.includes("pm") || nameId.includes("product") || nameId.includes("manager")) {
    return "pm";
  }
  if (nameId.includes("lead") || nameId.includes("principal") || nameId.includes("staff")) {
    return "eng-lead";
  }
  if (nameId.includes("architect") || nameId.includes("arch")) {
    return "architect";
  }
  if (nameId.includes("qa") || nameId.includes("test") || nameId.includes("quality")) {
    return "qa";
  }
  if (nameId.includes("design") || nameId.includes("ux") || nameId.includes("ui")) {
    return "designer";
  }
  if (nameId.includes("devops") || nameId.includes("infra") || nameId.includes("sre") || nameId.includes("platform")) {
    return "devops";
  }
  if (nameId.includes("data") || nameId.includes("analyst") || nameId.includes("ml") || nameId.includes("ai")) {
    return "data";
  }
  if (nameId.includes("support") || nameId.includes("customer") || nameId.includes("success")) {
    return "support";
  }
  if (nameId.includes("coder") || nameId.includes("dev") || nameId.includes("engineer") || nameId.includes("eng")) {
    return "coder";
  }
  
  return "generic";
}

// ── Role-Based Dialogue Pools ──

const CEO_DIALOGUES = [
  "How's the quarterly roadmap looking?",
  "We need to ship faster this sprint",
  "The investors are excited about our progress",
  "Let's double down on what's working",
  "Customer feedback has been really positive",
  "What's blocking the team right now?",
  "Revenue is trending up nicely 📈",
  "We should prioritize the enterprise features",
  "The market timing is perfect for this",
  "Let's schedule an all-hands soon",
  "How's team morale looking?",
  "Any concerns I should know about?",
  "Great work on the last release!",
  "We're ahead of competitors here",
  "The board meeting went well",
  "Let's focus on retention metrics",
  "Time to scale the team?",
  "The vision is coming together",
  "Keep up the momentum 🚀",
  "What's the ETA on that feature?",
];

const PM_DIALOGUES = [
  "Sprint velocity is looking good",
  "Let's do a quick retro after this",
  "The backlog needs grooming",
  "Users are asking for dark mode",
  "We should A/B test that flow",
  "The roadmap is on track",
  "Can we ship this by Friday?",
  "Product-market fit is improving",
  "Let's prioritize based on impact",
  "The feature request list is growing",
  "User interviews revealed some insights",
  "We need better analytics here",
  "The NPS score went up!",
  "Let's reduce scope to ship faster",
  "Stakeholders are aligned on this",
  "The MVP is almost ready",
  "Let's sync on requirements",
  "Customer journey needs work here",
  "We're solving a real pain point",
  "The metrics dashboard looks great",
];

const ENG_LEAD_DIALOGUES = [
  "Let's review the architecture decision",
  "The team is crushing it lately",
  "We should document this pattern",
  "PR reviews are backing up",
  "Technical debt is manageable",
  "Let's do a tech talk on this",
  "The incident response was solid",
  "Onboarding the new dev tomorrow",
  "Code quality metrics look healthy",
  "We need better test coverage here",
  "The refactor is paying off",
  "Let's standardize this approach",
  "Performance benchmarks are good",
  "Security audit came back clean",
  "The migration went smoothly",
  "Let's pair on this tricky part",
  "Build times are down 30%!",
  "The deployment pipeline is solid",
  "Good catch on that edge case",
  "Let's schedule a design review",
];

const ARCHITECT_DIALOGUES = [
  "Found some tech debt in the auth module",
  "The security audit looks clean",
  "We should add a cache layer here",
  "The API contract needs updating",
  "This pattern will scale better",
  "Let me sketch out the data flow",
  "The microservices are well-bounded",
  "We need to think about consistency",
  "The event sourcing approach works",
  "Let's avoid premature optimization",
  "The system design doc is ready",
  "Database schema needs a migration",
  "This abstraction is leaking",
  "Consider the failure modes here",
  "The rate limiting is robust",
  "Let's add circuit breakers",
  "The async flow is cleaner",
  "Think about backwards compatibility",
  "The dependency graph looks healthy",
  "We should decouple these services",
];

const CODER_DIALOGUES = [
  "Refactoring the API layer now",
  "This PR is ready for review",
  "Just fixed that edge case",
  "The tests are all passing ✅",
  "Found a cleaner way to do this",
  "TypeScript saved me again",
  "The hot reload is so nice",
  "Debugging this weird race condition",
  "The linter caught a bug",
  "Just shipped the new feature",
  "Working on the integration tests",
  "The docs need updating",
  "This abstraction is really clean",
  "Coffee and code time ☕",
  "Pair programming session went well",
  "The code review was helpful",
  "Just squashed those commits",
  "The CI pipeline is green",
  "Implemented the feedback",
  "This recursive solution is elegant",
];

const QA_DIALOGUES = [
  "All tests passing on main",
  "Found a regression in the dashboard",
  "The E2E suite is looking stable",
  "Edge case coverage improved",
  "Manual testing the new flow",
  "The bug report is filed",
  "Automation saved hours today",
  "Performance tests look good",
  "Found a flaky test to fix",
  "The test pyramid is balanced",
  "Cross-browser testing done",
  "Mobile testing revealed issues",
  "The coverage report is ready",
  "Smoke tests all green ✅",
  "Load testing results are in",
  "Found a security vulnerability",
  "The regression suite passed",
  "User acceptance testing done",
  "The bug is reproducible now",
  "Test data is refreshed",
];

const DESIGNER_DIALOGUES = [
  "The new flow feels smoother",
  "Need to fix the mobile layout",
  "User testing went great",
  "The design system is updated",
  "Accessibility audit is clean",
  "The prototype is ready",
  "Colors need more contrast",
  "The animation timing is right",
  "Figma file is organized now",
  "The component library grows",
  "Dark mode looks slick 🌙",
  "Typography hierarchy is better",
  "The empty states need work",
  "Icon set is consistent now",
  "The loading states feel good",
  "Responsive design is done",
  "The error messages are clearer",
  "Onboarding flow is simplified",
  "The visual hierarchy works",
  "Brand guidelines updated",
];

const DEVOPS_DIALOGUES = [
  "Deployment pipeline is solid",
  "Monitoring alerts are tuned",
  "The cluster is healthy",
  "Auto-scaling kicked in nicely",
  "Reduced cloud costs by 20%",
  "The backup completed",
  "SSL certs are renewed",
  "Kubernetes config is clean",
  "Logs are centralized now",
  "The incident was mitigated",
  "Terraform state is synced",
  "Docker images are optimized",
  "CI/CD is running smoothly",
  "Database replicas are healthy",
  "CDN cache is warmed up",
  "Security patches applied",
  "The rollback worked perfectly",
  "Infrastructure as code FTW",
  "Metrics dashboard is live",
  "Zero-downtime deploy done ✨",
];

const DATA_DIALOGUES = [
  "The ML model accuracy improved",
  "Data pipeline is running smoothly",
  "The analytics are insightful",
  "A/B test results are significant",
  "Feature engineering helped a lot",
  "The dashboard is updated",
  "Data quality checks passed",
  "ETL job completed on time",
  "The cohort analysis is ready",
  "Predictive model is deployed",
  "Data warehouse is optimized",
  "The report is generated",
  "User segmentation looks good",
  "Anomaly detection caught this",
  "The funnel analysis reveals...",
  "Retention metrics improved",
  "The recommendation engine works",
  "Data governance is in place",
  "Real-time analytics are live",
  "The experiment is conclusive",
];

const SUPPORT_DIALOGUES = [
  "Customer ticket resolved",
  "Response time is improving",
  "The FAQ is updated",
  "User feedback is actionable",
  "Escalated the critical issue",
  "Knowledge base is growing",
  "Customer satisfaction is up",
  "The chatbot handles basics",
  "Common issues documented",
  "Training the new support agent",
  "SLA compliance is good",
  "User onboarding improved",
  "The help center is clearer",
  "Feedback loop is working",
  "Customer success call went well",
  "The tutorial video helped",
  "Support queue is manageable",
  "Feature request forwarded",
  "Customer retention improved",
  "The community is helpful",
];

const GENERIC_DIALOGUES = [
  "Making good progress today",
  "Let me check on that",
  "Almost done with this task",
  "The coffee is good today ☕",
  "Productive morning so far",
  "Just wrapping this up",
  "Interesting challenge here",
  "Learning something new",
  "Collaboration is key",
  "Taking a quick break",
  "Back to work!",
  "The office vibes are good",
  "Focus mode activated",
  "Checking the notifications",
  "Just sent that update",
];

// ── Activity-Specific Dialogue Pools ──

const MEETING_DIALOGUES_BY_ROLE: Partial<Record<AgentRole, string[]>> = {
  ceo: [
    "What's our biggest risk right now?",
    "Let's align on the Q4 goals",
    "The competition is moving fast",
    "How do we 10x this?",
  ],
  pm: [
    "Let's prioritize the backlog",
    "User stories need refinement",
    "What's the acceptance criteria?",
    "Sprint planning after this",
  ],
  "eng-lead": [
    "Technical feasibility looks good",
    "We need to resource this properly",
    "Let's break this into phases",
    "Dependencies are mapped out",
  ],
  architect: [
    "The system design supports this",
    "Consider the scalability implications",
    "Let me draw the architecture",
    "Data flow needs clarity here",
  ],
  coder: [
    "I can implement that by tomorrow",
    "The API is straightforward",
    "Tests will cover edge cases",
    "Let me show the prototype",
  ],
  qa: [
    "Test plan is ready",
    "Regression risk is low",
    "We need UAT before release",
    "Automation will cover this",
  ],
  designer: [
    "The UX research supports this",
    "Let me share the mockups",
    "Accessibility is considered",
    "The flow is user-tested",
  ],
};

const COFFEE_DIALOGUES_BY_ROLE: Partial<Record<AgentRole, string[]>> = {
  ceo: ["Strategy brewing ☕", "Thinking about the roadmap"],
  pm: ["Prioritizing over coffee", "User stories in my head"],
  "eng-lead": ["Architecture thoughts...", "Team dynamics on my mind"],
  architect: ["System design pondering", "Patterns and coffee"],
  coder: ["Debugging juice ☕", "Code clarity incoming"],
  qa: ["Test scenarios brewing", "Quality needs caffeine"],
  designer: ["Design inspiration time", "UX thoughts percolating"],
};

const WHITEBOARD_DIALOGUES = [
  "So the data flows like this...",
  "What if we add a cache layer?",
  "Here's the architecture",
  "This connects to that service",
  "Let me draw the happy path",
  "We could optimize here",
  "Does this make sense?",
  "And this is the API contract",
  "The bottleneck is here",
  "Edge case: what if...",
  "Error handling goes here",
  "Let's trace the request flow",
];

const CODE_REVIEW_DIALOGUES = [
  "This looks clean 👍",
  "Found a potential issue here",
  "Nice refactor!",
  "What about null checks?",
  "Consider extracting this method",
  "Good test coverage",
  "This could be more DRY",
  "The naming is clear",
  "Small nit: formatting",
  "LGTM! ✅",
  "Have you tried...?",
  "This is elegant",
  "The edge case handling is solid",
  "Performance looks good",
  "Security-wise this is fine",
];

const PHONE_DIALOGUES_BY_ROLE: Partial<Record<AgentRole, string[]>> = {
  ceo: ["📱 Investor call...", "📱 Board update", "📱 Partnership discussion"],
  pm: ["📱 Stakeholder sync", "📱 Customer interview", "📱 Roadmap review"],
  "eng-lead": ["📱 Candidate interview", "📱 Vendor call", "📱 Tech sync"],
  support: ["📱 Customer issue", "📱 Escalation call", "📱 Follow-up"],
};

const COUCH_DIALOGUES = [
  "🛋️ Quick recharge",
  "Taking five minutes",
  "Brain break needed",
  "Recharging for the afternoon",
  "Just a moment of peace",
];

const WATER_COOLER_DIALOGUES = [
  "Did you see the latest PR?",
  "How was your weekend?",
  "Staying hydrated 💧",
  "The weather's nice today",
  "Any plans for lunch?",
  "That meeting was productive",
  "Have you tried the new café?",
];

const STRETCHING_DIALOGUES = [
  "🧘 Desk break time",
  "Been coding too long",
  "💪 Quick stretch",
  "Ergonomics matter",
  "Shoulders needed this",
];

const LUNCH_DIALOGUES_BY_ROLE: Partial<Record<AgentRole, string[]>> = {
  ceo: ["🍽️ Lunch meeting", "Grabbing a quick bite"],
  pm: ["🍽️ Working lunch", "Back in 30"],
  coder: ["🍽️ Lunch break!", "Fuel for coding"],
  generic: ["🍽️ Lunch time!", "Be back soon"],
};

const PRESENTATION_DIALOGUES = [
  "Next slide please...",
  "As you can see here...",
  "Let me walk you through this",
  "Any questions so far?",
  "Key takeaway is...",
  "Building on that point...",
  "In summary...",
  "The data shows...",
];

// ── Pair-Specific Conversation Templates ──

interface PairDialogue {
  roles: [AgentRole, AgentRole];
  dialogues: string[];
}

const PAIR_DIALOGUES: PairDialogue[] = [
  // Coder + Architect
  {
    roles: ["coder", "architect"],
    dialogues: [
      "Should I use the repository pattern here?",
      "The abstraction layer makes sense now",
      "How do we handle the migration?",
      "The dependency injection is cleaner",
      "Let me refactor this based on your feedback",
      "The interface design is solid",
      "I see why you structured it this way",
      "The patterns really help here",
      "Thanks for the architecture guidance",
      "The code is more maintainable now",
    ],
  },
  // CEO + PM
  {
    roles: ["ceo", "pm"],
    dialogues: [
      "How's the roadmap looking?",
      "Customer feedback is shaping priorities",
      "Let's focus on the key metrics",
      "The market timing is right",
      "Revenue goals are achievable",
      "User retention is improving",
      "We need to ship faster",
      "The vision is clear",
      "Stakeholders are aligned",
      "Great progress this quarter",
    ],
  },
  // QA + Coder
  {
    roles: ["qa", "coder"],
    dialogues: [
      "I found a bug in the new feature",
      "The edge case wasn't handled",
      "Tests are passing now",
      "Can you reproduce this?",
      "The fix looks good",
      "Let me add a test for that",
      "The regression is confirmed",
      "Coverage improved after the fix",
      "Thanks for the quick turnaround",
      "The automation caught it early",
    ],
  },
  // Designer + PM
  {
    roles: ["designer", "pm"],
    dialogues: [
      "The user research supports this",
      "Let's A/B test the new design",
      "Accessibility is prioritized",
      "The prototype is ready for feedback",
      "User testing went well",
      "The flow is simplified",
      "Mobile-first approach works",
      "The design system is scalable",
      "Users love the new UI",
      "Conversion improved with this",
    ],
  },
  // Eng Lead + Coder
  {
    roles: ["eng-lead", "coder"],
    dialogues: [
      "Let's pair on this complex part",
      "The PR looks good to merge",
      "Great job on the refactor",
      "How's the task progressing?",
      "Any blockers I can help with?",
      "The approach is solid",
      "Let's do a quick code review",
      "Performance optimization worked",
      "The team appreciates your work",
      "Knowledge sharing helps everyone",
    ],
  },
  // DevOps + Coder
  {
    roles: ["devops", "coder"],
    dialogues: [
      "The deployment pipeline is ready",
      "CI/CD is configured for this",
      "Docker image is optimized",
      "Environment variables are set",
      "The rollback strategy is clear",
      "Monitoring is in place",
      "Logs show the issue here",
      "Scaling is automatic now",
      "The infrastructure supports this",
      "Zero-downtime deploy worked!",
    ],
  },
  // Architect + Eng Lead
  {
    roles: ["architect", "eng-lead"],
    dialogues: [
      "The system design is approved",
      "Tech debt is manageable",
      "Let's schedule a design review",
      "The migration plan is solid",
      "Performance benchmarks look good",
      "Security considerations are addressed",
      "The architecture scales well",
      "Team capacity is sufficient",
      "Dependencies are documented",
      "The RFC is ready for review",
    ],
  },
  // Data + PM
  {
    roles: ["data", "pm"],
    dialogues: [
      "The metrics support this feature",
      "A/B test results are in",
      "User behavior data is insightful",
      "Conversion funnel looks good",
      "Retention improved this sprint",
      "The cohort analysis is ready",
      "Data-driven decision here",
      "The experiment is conclusive",
      "Analytics dashboard updated",
      "User segmentation helps targeting",
    ],
  },
  // Support + QA
  {
    roles: ["support", "qa"],
    dialogues: [
      "Customer reported this bug",
      "I can reproduce the issue",
      "The error message is unclear",
      "Users are confused here",
      "The fix will help customers",
      "FAQ needs updating",
      "Common issue documented",
      "Test case added for this",
      "Customer feedback is valuable",
      "The resolution satisfied them",
    ],
  },
  // CEO + Eng Lead
  {
    roles: ["ceo", "eng-lead"],
    dialogues: [
      "How's the team performing?",
      "Technical challenges are managed",
      "Hiring is progressing well",
      "The architecture supports growth",
      "Innovation is encouraged",
      "Team morale looks good",
      "Velocity is improving",
      "Tech stack is modern",
      "Engineering culture is strong",
      "Great leadership of the team",
    ],
  },
];

// ── Tool-Based Context ──

function getToolBasedDialogue(toolHistory: ToolCallRecord[]): string | null {
  if (toolHistory.length === 0) return null;
  
  const recentTool = toolHistory[toolHistory.length - 1];
  const toolName = recentTool.name.toLowerCase();
  
  // Generate contextual dialogue based on recent tool usage
  if (toolName.includes("read") || toolName.includes("file")) {
    const options = [
      "Just reviewed that file",
      "The code looks good",
      "Found what I was looking for",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (toolName.includes("write") || toolName.includes("edit")) {
    const options = [
      "Made some changes there",
      "The update is done",
      "Refactored that section",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (toolName.includes("exec") || toolName.includes("run") || toolName.includes("shell")) {
    const options = [
      "Command executed successfully",
      "The script ran fine",
      "Build completed",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (toolName.includes("search") || toolName.includes("web")) {
    const options = [
      "Found some useful info",
      "Research done",
      "The docs helped",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (toolName.includes("git") || toolName.includes("commit")) {
    const options = [
      "Just pushed that commit",
      "Changes are committed",
      "PR is ready",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (toolName.includes("test")) {
    const options = [
      "Tests are passing",
      "Added test coverage",
      "All green ✅",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  return null;
}

// ── Dialogue State Tracking ──

interface DialogueState {
  lastDialogueIndex: Map<string, number>;
  dialogueTimers: Map<string, number>;
  lastToolDialogue: Map<string, number>; // Timestamp of last tool-based dialogue
}

const dialogueState: DialogueState = {
  lastDialogueIndex: new Map(),
  dialogueTimers: new Map(),
  lastToolDialogue: new Map(),
};

// ── Public API ──

/**
 * Get the dialogue pool for a specific role.
 */
function getRoleDialoguePool(role: AgentRole): string[] {
  switch (role) {
    case "ceo": return CEO_DIALOGUES;
    case "pm": return PM_DIALOGUES;
    case "eng-lead": return ENG_LEAD_DIALOGUES;
    case "architect": return ARCHITECT_DIALOGUES;
    case "coder": return CODER_DIALOGUES;
    case "qa": return QA_DIALOGUES;
    case "designer": return DESIGNER_DIALOGUES;
    case "devops": return DEVOPS_DIALOGUES;
    case "data": return DATA_DIALOGUES;
    case "support": return SUPPORT_DIALOGUES;
    default: return GENERIC_DIALOGUES;
  }
}

/**
 * Get dialogue for activity, considering agent role.
 */
export function getDialogueForActivity(
  activityType: ActivityType,
  activityId: string,
  agent?: VisualAgent,
  partnerAgent?: VisualAgent,
): string | null {
  // First, check if we should use tool-based dialogue
  if (agent && agent.toolCallHistory.length > 0) {
    const lastToolTime = dialogueState.lastToolDialogue.get(agent.id) ?? 0;
    const now = Date.now();
    // Use tool-based dialogue occasionally (not every time)
    if (now - lastToolTime > 30000 && Math.random() < 0.3) {
      const toolDialogue = getToolBasedDialogue(agent.toolCallHistory);
      if (toolDialogue) {
        dialogueState.lastToolDialogue.set(agent.id, now);
        return toolDialogue;
      }
    }
  }
  
  const role = agent ? detectAgentRole(agent) : "generic";
  const partnerRole = partnerAgent ? detectAgentRole(partnerAgent) : null;
  
  // Check for pair-specific dialogue
  if (partnerRole && Math.random() < 0.4) {
    const pairDialogue = getPairDialogue(role, partnerRole);
    if (pairDialogue) return pairDialogue;
  }
  
  let pool: string[] = [];
  
  switch (activityType) {
    case "meeting":
    case "presentationMode":
      pool = MEETING_DIALOGUES_BY_ROLE[role] ?? MEETING_DIALOGUES_BY_ROLE["coder"] ?? [];
      if (pool.length === 0) pool = PRESENTATION_DIALOGUES;
      break;
    case "coffeeRun":
      pool = COFFEE_DIALOGUES_BY_ROLE[role] ?? ["☕ Coffee time", "Quick caffeine break"];
      break;
    case "pairChat":
    case "waterCooler":
      // Mix of role-specific and water cooler
      pool = [...getRoleDialoguePool(role).slice(0, 5), ...WATER_COOLER_DIALOGUES];
      break;
    case "whiteboarding":
      pool = WHITEBOARD_DIALOGUES;
      break;
    case "codeReview":
      pool = CODE_REVIEW_DIALOGUES;
      break;
    case "phoneCalling":
      pool = PHONE_DIALOGUES_BY_ROLE[role] ?? ["📱 On a call...", "📱 Quick sync"];
      break;
    case "stretching":
      pool = STRETCHING_DIALOGUES;
      break;
    case "couchBreak":
      pool = COUCH_DIALOGUES;
      break;
    case "lunchBreak":
      pool = LUNCH_DIALOGUES_BY_ROLE[role] ?? LUNCH_DIALOGUES_BY_ROLE["generic"] ?? ["🍽️ Lunch time"];
      break;
    default:
      pool = getRoleDialoguePool(role);
  }

  if (pool.length === 0) return null;

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
 * Get pair-specific dialogue based on both roles.
 */
function getPairDialogue(role1: AgentRole, role2: AgentRole): string | null {
  for (const pair of PAIR_DIALOGUES) {
    if ((pair.roles[0] === role1 && pair.roles[1] === role2) ||
        (pair.roles[0] === role2 && pair.roles[1] === role1)) {
      return pair.dialogues[Math.floor(Math.random() * pair.dialogues.length)];
    }
  }
  return null;
}

/**
 * Check if an agent should display a new dialogue.
 */
export function shouldShowDialogue(agentId: string, dt: number): boolean {
  let timer = dialogueState.dialogueTimers.get(agentId) ?? 0;
  timer -= dt;
  
  if (timer <= 0) {
    timer = 3 + Math.random() * 3; // 3-6 seconds
    dialogueState.dialogueTimers.set(agentId, timer);
    return true;
  }
  
  dialogueState.dialogueTimers.set(agentId, timer);
  return false;
}

/**
 * Get the dialogue probability based on activity type.
 */
export function getDialogueProbability(activityType: ActivityType): number {
  switch (activityType) {
    case "phoneCalling":
    case "presentationMode":
      return 0.85;
    case "meeting":
    case "pairChat":
    case "whiteboarding":
    case "codeReview":
      return 0.7;
    case "coffeeRun":
    case "stretching":
      return 0.4;
    case "couchBreak":
    case "waterCooler":
      return 0.5;
    case "lunchBreak":
      return 0.25;
    default:
      return 0.4;
  }
}

/**
 * Clean up dialogue state for completed activities.
 */
export function clearDialogueState(activityId: string): void {
  dialogueState.lastDialogueIndex.delete(activityId);
}

/**
 * Reset all dialogue timers.
 */
export function resetDialogueTimers(): void {
  dialogueState.dialogueTimers.clear();
}

// ── Export for testing ──

export const ROLE_DIALOGUES = {
  ceo: CEO_DIALOGUES,
  pm: PM_DIALOGUES,
  "eng-lead": ENG_LEAD_DIALOGUES,
  architect: ARCHITECT_DIALOGUES,
  coder: CODER_DIALOGUES,
  qa: QA_DIALOGUES,
  designer: DESIGNER_DIALOGUES,
  devops: DEVOPS_DIALOGUES,
  data: DATA_DIALOGUES,
  support: SUPPORT_DIALOGUES,
  generic: GENERIC_DIALOGUES,
};

export { PAIR_DIALOGUES };
