import { api } from "@/lib/api-client";
import type { AdminLoginInput, AdminStatus } from "./schema";

export const adminApi = {
  status: () => api<AdminStatus>("/api/admin"),
  login: (input: AdminLoginInput) => api<AdminStatus>("/api/admin", { method: "POST", json: input }),
  logout: () => api<void>("/api/admin", { method: "DELETE" }),
};
