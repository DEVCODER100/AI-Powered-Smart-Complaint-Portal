import type { AdminCluster, Complaint, NotificationItem } from "./types";

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
  adminComplaints: () => request<{ clusters: AdminCluster[] }>("/admin/complaints"),
  setStatus: (code: string, status: string) =>
    request<{ complaint: AdminCluster }>(`/complaints/${code}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // notifications
  notifications: () => request<{ notifications: NotificationItem[] }>("/notifications"),
  markAllRead: () => request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
};
