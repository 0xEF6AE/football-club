import { api } from "@/lib/api-client";
import type { FormationInput, SavedFormation } from "./schema";

export const formationsApi = {
  list: () => api<SavedFormation[]>("/api/formations"),
  create: (input: FormationInput) =>
    api<SavedFormation>("/api/formations", { method: "POST", json: input }),
  update: ({ id, input }: { id: string; input: FormationInput }) =>
    api<SavedFormation>(`/api/formations/${id}`, { method: "PATCH", json: input }),
  remove: (id: string) => api<void>(`/api/formations/${id}`, { method: "DELETE" }),
};
