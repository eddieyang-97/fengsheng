import { useLayoutEffect, useRef, useState } from "react";

import "./game-event-animations.css";

export type GameEventAnimationKind = "draw" | "burn" | "counter";

export interface ParsedGameEventAnimation {
  kind: GameEventAnimationKind;
  actorId?: string;
  targetPlayerId?: string;
  label: string;
}

interface PositionedGameEventAnimation extends ParsedGameEventAnimation {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delayMs: number;
}

export interface GameEventAnimationLayerProps {
  auditEntries: readonly string[];
  ownPlayerId: string;
  playerIds: readonly string[];
}

function playerAtStart(entry: string, playerIds: readonly string[]): string | undefined {
  return [...playerIds]
    .sort((left, right) => right.length - left.length)
    .find((playerId) => entry.startsWith(playerId));
}

export function parseGameEventAnimation(
  entry: string,
  playerIds: readonly string[],
): ParsedGameEventAnimation | undefined {
  const actorId = playerAtStart(entry, playerIds);
  if (actorId && entry.startsWith(`${actorId}回合开始并摸`)) {
    return { kind: "draw", actorId, label: "摸牌" };
  }

  const burnedTargetId = playerIds.find(
    (playerId) =>
      entry.startsWith(`${playerId}的黑色情报`) &&
      entry.includes("被烧毁并公开弃置"),
  );
  if (burnedTargetId) {
    return {
      kind: "burn",
      targetPlayerId: burnedTargetId,
      label: "烧毁",
    };
  }

  if (actorId && entry.startsWith(`${actorId}使用识破`)) {
    return { kind: "counter", actorId, label: "识破" };
  }

  return undefined;
}

function centerOf(element: Element | null): { x: number; y: number } | undefined {
  if (!(element instanceof HTMLElement)) return undefined;
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;
  const edgeInset = 24;
  return {
    x: Math.min(
      Math.max(edgeInset, bounds.left + bounds.width / 2),
      Math.max(edgeInset, window.innerWidth - edgeInset),
    ),
    y: Math.min(
      Math.max(edgeInset, bounds.top + bounds.height / 2),
      Math.max(edgeInset, window.innerHeight - edgeInset),
    ),
  };
}

function anchor(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-game-animation-anchor="${name}"]`);
}

function playerAnchor(playerId: string, kind: "seat" | "intelligence"): HTMLElement | null {
  const attribute = kind === "seat"
    ? "data-game-animation-player-id"
    : "data-game-animation-intelligence-player-id";
  return [...document.querySelectorAll<HTMLElement>(`[${attribute}]`)]
    .find((element) => element.getAttribute(attribute) === playerId) ?? null;
}

function positionedAnimation(
  event: ParsedGameEventAnimation,
  ownPlayerId: string,
  id: number,
  delayMs: number,
): PositionedGameEventAnimation | undefined {
  const tableCenter = centerOf(anchor("table"));
  const responseCenter = centerOf(anchor("response")) ?? tableCenter;
  let from = tableCenter;
  let to = responseCenter;

  if (event.kind === "draw" && event.actorId) {
    from = centerOf(anchor("deck")) ?? tableCenter;
    to = event.actorId === ownPlayerId
      ? centerOf(anchor("own-hand")) ?? centerOf(playerAnchor(event.actorId, "seat")) ?? tableCenter
      : centerOf(playerAnchor(event.actorId, "seat")) ?? tableCenter;
  } else if (event.kind === "burn" && event.targetPlayerId) {
    from = centerOf(playerAnchor(event.targetPlayerId, "intelligence"))
      ?? centerOf(playerAnchor(event.targetPlayerId, "seat"))
      ?? tableCenter;
    to = from;
  } else if (event.kind === "counter") {
    from = responseCenter;
    to = responseCenter;
  }

  if (!from || !to) return undefined;
  return {
    ...event,
    id,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    delayMs,
  };
}

export function GameEventAnimationLayer({
  auditEntries,
  ownPlayerId,
  playerIds,
}: GameEventAnimationLayerProps) {
  const previousEntries = useRef<readonly string[] | undefined>(undefined);
  const nextId = useRef(1);
  const [active, setActive] = useState<PositionedGameEventAnimation[]>([]);

  useLayoutEffect(() => {
    const previous = previousEntries.current;
    previousEntries.current = [...auditEntries];
    if (!previous) return;
    const continuesPreviousLog =
      auditEntries.length >= previous.length &&
      previous.every((entry, index) => auditEntries[index] === entry);
    if (!continuesPreviousLog) return;

    const additions = auditEntries
      .slice(previous.length)
      .map((entry) => parseGameEventAnimation(entry, playerIds))
      .filter((event): event is ParsedGameEventAnimation => Boolean(event))
      .flatMap((event, index) => {
        const positioned = positionedAnimation(
          event,
          ownPlayerId,
          nextId.current++,
          Math.min(index * 90, 270),
        );
        return positioned ? [positioned] : [];
      });
    if (additions.length > 0) setActive((current) => [...current, ...additions]);
  }, [auditEntries, ownPlayerId, playerIds]);

  return (
    <div aria-hidden="true" className="game-event-animation-layer">
      {active.map((event) => (
        <div
          className={`game-event-animation game-event-animation--${event.kind}`}
          key={event.id}
          onAnimationEnd={() => setActive((current) =>
            current.filter((candidate) => candidate.id !== event.id)
          )}
          style={{
            "--game-event-delay": `${event.delayMs}ms`,
            "--game-event-from-x": `${event.fromX}px`,
            "--game-event-from-y": `${event.fromY}px`,
            "--game-event-to-x": `${event.toX}px`,
            "--game-event-to-y": `${event.toY}px`,
          } as React.CSSProperties}
        >
          {event.kind === "counter"
            ? <span className="game-event-animation__counter">识破</span>
            : (
                <span className="game-event-animation__card">
                  <i />
                  <strong>{event.label}</strong>
                </span>
              )}
        </div>
      ))}
    </div>
  );
}
