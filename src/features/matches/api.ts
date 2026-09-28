import { api } from "@/lib/api-client";
import type { Match, MatchInput } from "./schema";

export const matchesApi = {
  list: () => api<Match[]>("/api/matches"),
  get: (id: string) => api<Match>(`/api/matches/${id}`),
  create: (input: MatchInput) => api<Match>("/api/matches", { method: "POST", json: input }),
  update: ({ id, input }: { id: string; input: MatchInput }) =>
    api<Match>(`/api/matches/${id}`, { method: "PATCH", json: input }),
  remove: (id: string) => api<void>(`/api/matches/${id}`, { method: "DELETE" }),
};
