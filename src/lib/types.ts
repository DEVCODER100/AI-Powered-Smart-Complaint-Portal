export type Category = "plumbing" | "wifi" | "electrical" | "cleaning" | "other";

export type Severity = "critical" | "high" | "normal";

/** Pipeline stages plus the admin-only terminal state "rejected". */
export type Status = "pending" | "in-progress" | "waiting" | "done" | "rejected";

/** The four pipeline steps shown in the progress tracker (rejected is separate). */
export const STATUS_ORDER: Status[] = ["pending", "in-progress", "waiting", "done"];

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  waiting: "Waiting",
  done: "Done",
  rejected: "Rejected",
};

/** A worker (plumber, electrician, …) available to be assigned. */
export interface Worker {
  id: number;
  name: string;
  phone: string;
  role: string;
  department: string;
  isAvailable: boolean;
}

/** The worker currently assigned to a complaint, shown to reporters. */
export interface Assignment {
  workerName: string;
  workerRole: string;
  workerPhone: string;
  etaStart: string | null; // ISO
  etaEnd: string | null; // ISO
}

export interface Complaint {
  id: string; // e.g. "C-017"
  category: Category;
  block: string; // e.g. "Block C"
  floor: string; // e.g. "Floor 2" | "All Floors"
  severity: Severity;
  status: Status;
  /** Short AI-generated summary; falls back to description when absent. */
  title: string | null;
  description: string;
  reportedAgoMinutes: number;
  othersReported: number; // de-duplicated cluster count, excluding the viewer
  assignment?: Assignment | null; // F10 — who is coming + ETA
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  agoMinutes: number;
  unread: boolean;
}

/** Admin-only cluster view of a complaint, with routing + SLA fields. */
export interface AdminCluster extends Complaint {
  department: string;
  slaTargetHours: number; // response target for the severity
  ageHours: number; // how long the cluster has been open
  aiFlagged: boolean; // AI was uncertain → needs admin review
  possibleDuplicateOf: string | null; // code of a near-duplicate complaint
  statusNote: string | null; // reason recorded on reject/reopen
}

/** A reporter attached to a cluster (admin unmerge view). */
export interface Reporter {
  userId: number;
  name: string;
  rawText: string | null;
  agoMinutes: number;
}
