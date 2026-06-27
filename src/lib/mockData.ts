import type {
  AdminCluster,
  Category,
  Complaint,
  NotificationItem,
  Severity,
} from "./types";

/** category -> auto-routed department (PDF Feature 4). */
export const DEPARTMENTS: Record<Category, string> = {
  plumbing: "Maintenance",
  wifi: "IT",
  electrical: "Maintenance",
  cleaning: "Housekeeping",
  other: "Front Office",
};

/** Response targets per severity (PDF Feature 6). */
export const SLA_TARGET_HOURS: Record<Severity, number> = {
  critical: 2,
  high: 24,
  normal: 72,
};

/** The three example prompts shown under the intake box. */
export const EXAMPLES = [
  "No water in Block C second floor since morning",
  "WiFi keeps dropping in Block B during online class",
  "Sparking socket near the washbasin in Block A",
];

/** The logged-in student's own complaints (screenshots 3 & 4). */
export const MY_COMPLAINTS: Complaint[] = [
  {
    id: "C-017",
    category: "plumbing",
    block: "Block C",
    floor: "Floor 2",
    severity: "high",
    status: "in-progress",
    description:
      "No water in Block C second floor since morning. Taps are completely dry, can't even brush.",
    reportedAgoMinutes: 180,
    othersReported: 17,
  },
  {
    id: "C-015",
    category: "wifi",
    block: "Block B",
    floor: "All Floors",
    severity: "high",
    status: "waiting",
    description:
      "WiFi keeps dropping every few minutes in the entire B wing, online class got disconnected 4 times.",
    reportedAgoMinutes: 360,
    othersReported: 24,
  },
  {
    id: "C-010",
    category: "wifi",
    block: "Block A",
    floor: "Floor 4",
    severity: "normal",
    status: "done",
    description:
      "WiFi router on the 4th floor of Block A is completely dead, no signal at all.",
    reportedAgoMinutes: 2880,
    othersReported: 4,
  },
];

/** Notifications shown in the bell dropdown (screenshot 5). */
export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Update on your water complaint",
    body: "C-017 (Block C · Floor 2) moved to In Progress. A plumber has been assigned.",
    agoMinutes: 12,
    unread: true,
  },
  {
    id: "n2",
    title: "WiFi issue acknowledged",
    body: "C-015 is now Waiting on parts. 24 students reported this.",
    agoMinutes: 60,
    unread: true,
  },
  {
    id: "n3",
    title: "Resolved 🎉",
    body: "Your WiFi router complaint (C-010) was marked Done.",
    agoMinutes: 2880,
    unread: false,
  },
];

/** Admin dashboard clusters — pre-sorted by severity then report count. */
export const ADMIN_CLUSTERS: AdminCluster[] = [
  {
    id: "C-021",
    category: "electrical",
    block: "Block A",
    floor: "Floor 1",
    severity: "critical",
    status: "pending",
    description:
      "Sparking socket near the washbasin in Block A — water is right next to it, looks dangerous.",
    reportedAgoMinutes: 200,
    othersReported: 6,
    department: DEPARTMENTS.electrical,
    slaTargetHours: SLA_TARGET_HOURS.critical,
    ageHours: 3,
  },
  {
    id: "C-017",
    category: "plumbing",
    block: "Block C",
    floor: "Floor 2",
    severity: "high",
    status: "in-progress",
    description:
      "No water in Block C second floor since morning. Taps are completely dry across the floor.",
    reportedAgoMinutes: 180,
    othersReported: 17,
    department: DEPARTMENTS.plumbing,
    slaTargetHours: SLA_TARGET_HOURS.high,
    ageHours: 3,
  },
  {
    id: "C-015",
    category: "wifi",
    block: "Block B",
    floor: "All Floors",
    severity: "high",
    status: "waiting",
    description:
      "WiFi keeps dropping every few minutes in the entire B wing during online classes.",
    reportedAgoMinutes: 360,
    othersReported: 24,
    department: DEPARTMENTS.wifi,
    slaTargetHours: SLA_TARGET_HOURS.high,
    ageHours: 28, // overdue vs 24h target -> red SLA flag
  },
  {
    id: "C-019",
    category: "cleaning",
    block: "Block D",
    floor: "Floor 3",
    severity: "normal",
    status: "pending",
    description:
      "Common bathroom on the 3rd floor of Block D hasn't been cleaned in three days.",
    reportedAgoMinutes: 1200,
    othersReported: 9,
    department: DEPARTMENTS.cleaning,
    slaTargetHours: SLA_TARGET_HOURS.normal,
    ageHours: 20,
  },
  {
    id: "C-010",
    category: "wifi",
    block: "Block A",
    floor: "Floor 4",
    severity: "normal",
    status: "done",
    description: "WiFi router on the 4th floor of Block A was completely dead.",
    reportedAgoMinutes: 2880,
    othersReported: 4,
    department: DEPARTMENTS.wifi,
    slaTargetHours: SLA_TARGET_HOURS.normal,
    ageHours: 48,
  },
];
