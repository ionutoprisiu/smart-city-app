export type Role = "USER" | "ORGANIZER" | "ADMIN";

export type VerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "MANUAL_REVIEW";

export interface AuthResponse {
  userId?: number;
  email?: string;
  role?: Role;
  accessToken?: string;
  message: string;
}

export interface AdminVerificationItem {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  verificationStatus: VerificationStatus;
  verificationScore?: number | null;
  verificationReason?: string | null;
  idCardImageUrl?: string | null;
  faceImageUrl?: string | null;
  createdAt?: string | null;
}

export interface AdminUserItem {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
}

const TOKEN_KEY = "admin_access_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "Request failed";
    throw new Error(detail);
  }

  return data as T;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchVerifications(status?: VerificationStatus): Promise<AdminVerificationItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiFetch<{ items: AdminVerificationItem[] }>(
    `/api/admin/verifications${query}`,
  );
  return data.items;
}

export async function fetchPendingVerifications(): Promise<AdminVerificationItem[]> {
  return fetchVerifications("MANUAL_REVIEW");
}

export async function approveVerification(userId: number): Promise<AdminVerificationItem> {
  return apiFetch<AdminVerificationItem>(`/api/admin/verifications/${userId}/approve`, {
    method: "POST",
  });
}

export async function rejectVerification(
  userId: number,
  reason?: string,
): Promise<AdminVerificationItem> {
  return apiFetch<AdminVerificationItem>(`/api/admin/verifications/${userId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || null }),
  });
}

export async function allowResubmit(userId: number): Promise<AdminVerificationItem> {
  return apiFetch<AdminVerificationItem>(`/api/admin/verifications/${userId}/allow-resubmit`, {
    method: "POST",
  });
}

export async function fetchUsers(): Promise<AdminUserItem[]> {
  const data = await apiFetch<{ items: AdminUserItem[] }>("/api/admin/users");
  return data.items;
}

export async function promoteOrganizer(userId: number): Promise<AdminUserItem> {
  return apiFetch<AdminUserItem>(`/api/admin/users/${userId}/promote-organizer`, {
    method: "POST",
  });
}

export async function demoteToUser(userId: number): Promise<AdminUserItem> {
  return apiFetch<AdminUserItem>(`/api/admin/users/${userId}/demote-user`, {
    method: "POST",
  });
}

export async function resetUserVerification(userId: number): Promise<AdminUserItem> {
  return apiFetch<AdminUserItem>(`/api/admin/users/${userId}/reset-verification`, {
    method: "POST",
  });
}
