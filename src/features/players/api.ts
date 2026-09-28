import { api } from "@/lib/api-client";
import type { Player, PlayerInput } from "./schema";

export const playersApi = {
  list: () => api<Player[]>("/api/players"),
  create: (input: PlayerInput) => api<Player>("/api/players", { method: "POST", json: input }),
  update: ({ id, input }: { id: string; input: PlayerInput }) =>
    api<Player>(`/api/players/${id}`, { method: "PATCH", json: input }),
  remove: (id: string) => api<void>(`/api/players/${id}`, { method: "DELETE" }),
};
