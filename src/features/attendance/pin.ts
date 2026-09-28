import { PIN_PATTERN } from "@/features/players/schema";
import { ApiError } from "@/lib/api-client";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

/**
 * 이 기기에 기억해 둔 PIN (브라우저 전용).
 * 서버가 한 번 받아 준 PIN만 저장하고, 서버가 "PIN이 틀렸다"고 하면 지운다.
 */
export type SavedPins = Record<string, string>;

export function readPins(): SavedPins {
  const raw = readStorage(STORAGE_KEYS.pins);
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string" && PIN_PATTERN.test(entry[1])),
  );
}

export function writePins(pins: SavedPins) {
  writeStorage(STORAGE_KEYS.pins, pins);
}

export const isValidPin = (value: string) => PIN_PATTERN.test(value);

/** 서버가 PIN 때문에 거절했는지 (틀림, 미입력). 잠금(429)은 PIN이 맞았을 수도 있어 여기 넣지 않는다. */
export function isPinRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.issues.some((issue) => issue.path === "pin");
}
