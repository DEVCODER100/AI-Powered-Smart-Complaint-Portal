export type Category = "plumbing" | "wifi" | "electrical" | "cleaning" | "other";

export type Severity = "critical" | "high" | "normal";

/** Pipeline stages, in order. */
export type Status = "pending" | "in-progress" | "waiting" | "done";

export const STATUS_ORDER: Status[] = ["pending", "in-progress", "waiting", "done"];

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  waiting: "Waiting",
  done: "Done",
};

export interface Complaint {
  id: string; // e.g. "C-017"
  category: Category;
  block: string; // e.g. "Block C"
  floor: string; // e.g. "Floor 2" | "All Floors"
  severity: Severity;
  status: Status;
  description: string;
  reportedAgoMinutes: number;
  othersReported: number; // de-duplicated cluster count, excluding the viewer
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
}
