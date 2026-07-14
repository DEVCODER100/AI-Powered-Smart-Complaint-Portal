import type { AdminCluster, Complaint, NotificationItem, Reporter } from "./types";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "student" | "admin";
  room?: string;
  block?: string;
}

const TOKEN_KEY = "resolveai_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  // auth
  register: (body: { name: string; email: string; password: string; room?: string; block?: string }) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  googleLogin: (credential: string) =>
    request<{ token: string; user: User }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  me: () => request<{ user: User }>("/auth/me"),

  // complaints
  createComplaint: (text: string) =>
    request<{ complaint: Complaint; merged: boolean; message: string }>("/complaints", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  myComplaints: () => request<{ complaints: Complaint[] }>("/complaints/mine"),

  // admin
  adminComplaints: (limit = 100, offset = 0) =>
    request<{ clusters: AdminCluster[]; total: number; limit: number; offset: number }>(
      `/admin/complaints?limit=${limit}&offset=${offset}`
    ),
  setStatus: (code: string, status: string, reason?: string) =>
    request<{ complaint: AdminCluster }>(`/complaints/${code}/status`, {
      method: "PATCH",
      body: JSON.stringify(reason ? { status, reason } : { status }),
    }),
  reporters: (code: string) =>
    request<{ reporters: Reporter[] }>(`/admin/complaints/${code}/reporters`),
  detachReporter: (code: string, userId: number) =>
    request<{ cluster: AdminCluster; detached: AdminCluster }>(
      `/admin/complaints/${code}/detach/${userId}`,
      { method: "POST" }
    ),
  correctClassification: (
    code: string,
    fields: Partial<Pick<AdminCluster, "category" | "severity" | "block" | "floor">>
  ) =>
    request<{ complaint: AdminCluster }>(`/admin/complaints/${code}/classification`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),

  // notifications
  notifications: (limit = 20, offset = 0) =>
    request<{ notifications: NotificationItem[]; total: number }>(
      `/notifications?limit=${limit}&offset=${offset}`
    ),
  markAllRead: () => request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
};
