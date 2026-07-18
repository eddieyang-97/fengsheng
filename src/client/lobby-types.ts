export const AUTO_PASS_DELAY_OPTIONS_MS = [0, 500, 1_000, 2_000, 3_000, 5_000] as const;
export type AutoPassDelayMs = (typeof AUTO_PASS_DELAY_OPTIONS_MS)[number];
export const DEFAULT_AUTO_PASS_DELAY_MS: AutoPassDelayMs = 1_000;

export function isAutoPassDelayMs(value: number): value is AutoPassDelayMs {
  return (AUTO_PASS_DELAY_OPTIONS_MS as readonly number[]).includes(value);
}

export function parseAutoPassDelayPreference(value: string | null): AutoPassDelayMs {
  if (value === null) return DEFAULT_AUTO_PASS_DELAY_MS;
  const parsed = Number(value);
  return isAutoPassDelayMs(parsed) ? parsed : DEFAULT_AUTO_PASS_DELAY_MS;
}

export const SUPPORTED_PLAYER_COUNTS = [2, 5, 6, 7, 8] as const;

export type PlayerCount = (typeof SUPPORTED_PLAYER_COUNTS)[number];

export const REACTION_TIMEOUT_OPTIONS = [0, 10, 15, 20, 30, 60] as const;

export type ReactionTimeoutSeconds =
  (typeof REACTION_TIMEOUT_OPTIONS)[number];

export type StartMode = "current-seats" | "random-seats";

export interface CreateRoomInput {
  displayName: string;
  playerCount: PlayerCount;
  roomCode?: string;
}
export interface JoinRoomInput {
  displayName: string;
  roomCode: string;
}

export type InviteEntryState =
  | { kind: "none" }
  | { kind: "loading"; roomCode: string }
  | { kind: "valid"; roomCode: string }
  | { kind: "invalid"; roomCode: string; message?: string };

export interface LobbyPlayer {
  id: string;
  displayName: string;
  seat: number;
  isHost: boolean;
  isConnected: boolean;
  isBot: boolean;
}

export interface SeatSwapRequest {
  id: string;
  fromPlayerId: string;
  fromDisplayName: string;
  fromSeat: number;
  toPlayerId: string;
  toDisplayName: string;
  toSeat: number;
}
