import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type {
  Faction,
  PhysicalCard,
  PhysicalCardId,
  SecretOrderWord,
} from "../game/cards";
import type { PlayerProjection } from "../game/engine";
import type { ChatMessageSnapshot, PublicAuditEvent } from "../room";
import type { GameCommand, ReactionTimerSnapshot } from "../server";
import type { PlayerReactionEvent, PlayerReactionKind } from "../social-reactions";
import { cardArtPath, HiddenIntelligenceArtwork } from "./CardArtwork";
import { ChatPanel, PlayerChatBubble, usePlayerChatBubbles } from "./ChatPanel";
import { DiscardPileButton, DiscardPileDialog } from "./DiscardPile";
import { FinalHandsPanel } from "./FinalHandsPanel";
import {
  cardVariantText,
  compactCardMeta,
  GameCard as CardView,
  privateNoticeVariantText,
  probeIdentityNoticeText,
  publicCardSummary,
} from "./GameCard";
import { GameEventAnimationLayer } from "./GameEventAnimationLayer";
import {
  GAME_SHORTCUT_BINDINGS,
  gameShortcutIntent,
  nextSelectableCardId,
  shouldHandleGameShortcutFromElement,
  TRANSMISSION_OPTION_KEYS,
  transmissionOptionShortcutIndex,
} from "./game-shortcuts";
import { PlayerReactionLayer, PlayerReactionMenu } from "./PlayerReactionLayer";
import { ResizableGameSidebar } from "./ResizableGameSidebar";
import {
  AUTO_PASS_DELAY_OPTIONS_MS,
  REACTION_TIMEOUT_OPTIONS,
  type AutoPassDelayMs,
  type ReactionTimeoutSeconds,
} from "./lobby-types";
import "./game-table.css";

export type ProjectedLegalAction = PlayerProjection["legalActions"][number];
type StartTransmissionAction = Extract<
  ProjectedLegalAction,
  { type: "START_TRANSMISSION" }
>;
type BurnCommand = Extract<GameCommand, { type: "PLAY_BURN" }>;
type ProjectedReactionKind = NonNullable<PlayerProjection["reactionWindow"]>["kind"];
type ProjectedReceiptStage = NonNullable<PlayerProjection["transmission"]>["receiptStage"];
export type IdentityMarker = "" | Faction;

export interface GameTableProps {
  projection: PlayerProjection;
  playerDisplayNames?: Readonly<Record<string, string>>;
  connected: boolean;
  busy?: boolean;
  errorMessage?: string;
  reactionTimer?: ReactionTimerSnapshot | null;
  isHost?: boolean;
  reactionTimeoutSeconds: ReactionTimeoutSeconds;
  autoPassDelayMs: AutoPassDelayMs;
  soundEnabled: boolean;
  publicAuditEvents?: readonly PublicAuditEvent[];
  chatMessages?: readonly ChatMessageSnapshot[];
  playerReactions?: readonly PlayerReactionEvent[];
  spectators?: readonly { id: string; displayName: string; connected: boolean }[];
  disconnectedLivingPlayers?: readonly {
    id: string;
    displayName: string;
    botControlled: boolean;
  }[];
  onReactionTimeoutChange: (seconds: ReactionTimeoutSeconds) => void;
  onAutoPassDelayChange: (milliseconds: AutoPassDelayMs) => void;
  onSoundEnabledChange: (enabled: boolean) => void;
  onMarkDisconnectedPlayerDead: (playerId: string) => void;
  onSetBotTakeover: (playerId: string, enabled: boolean) => void;
  onNewGame: () => void;
  onSendChat: (text: string) => void;
  onPlayerReaction: (kind: PlayerReactionKind, targetPlayerId: string) => void;
  onCommand: (command: GameCommand) => void;
}

const AUTO_PASS_STORAGE_KEY = "fengsheng:auto-pass-no-action";
const AUTO_PASS_IGNORE_BURN_STORAGE_KEY = "fengsheng:auto-pass-ignore-burn";
const KEYBOARD_SHORTCUTS_STORAGE_KEY = "fengsheng:keyboard-shortcuts";

export function automaticPassCommand(
  actions: readonly ProjectedLegalAction[],
  ignoreBurn = false,
): Extract<GameCommand, { type: "PASS_REACTION" | "PASS_LOCK" }> | undefined {
  const relevantActions = ignoreBurn
    ? actions.filter((action) => action.type !== "PLAY_BURN")
    : actions;
  if (relevantActions.length !== 1) return undefined;
  const action = relevantActions[0];
  return action?.type === "PASS_REACTION" || action?.type === "PASS_LOCK"
    ? action
    : undefined;
}

export function automaticPassDelayMs(
  action: Extract<GameCommand, { type: "PASS_REACTION" | "PASS_LOCK" }>,
  handCount = 0,
  configuredDelayMs: AutoPassDelayMs = 1_000,
): number {
  if (action.type === "PASS_LOCK") return 0;
  return handCount === 0 ? 0 : configuredDelayMs;
}

export function isNearScrollBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = 32,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function horizontalOverflowIndicators(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  threshold = 8,
): { left: boolean; right: boolean } {
  return {
    left: scrollLeft > threshold,
    right: scrollWidth - clientWidth - scrollLeft > threshold,
  };
}

function loadAutoPassPreference(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_PASS_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function loadAutoPassIgnoreBurnPreference(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_PASS_IGNORE_BURN_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function loadKeyboardShortcutsPreference(): boolean {
  try {
    const stored = localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function ReactionCountdown({ timer }: { timer: ReactionTimerSnapshot }) {
  const [now, setNow] = useState(() => performance.now());
  const [localDeadline, setLocalDeadline] = useState(
    () => performance.now() + timer.remainingMs,
  );

  useEffect(() => {
    const receivedAt = performance.now();
    setNow(receivedAt);
    setLocalDeadline(receivedAt + timer.remainingMs);
    if (timer.paused) return;
    const interval = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(interval);
  }, [timer.paused, timer.promptId, timer.remainingMs]);

  const remainingMs = timer.paused
    ? timer.remainingMs
    : Math.max(0, localDeadline - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return (
    <span className={`reaction-countdown${timer.paused ? " reaction-countdown--paused" : ""}`}>
      {timer.paused ? `计时暂停 · ${remainingSeconds} 秒` : `${remainingSeconds} 秒`}
    </span>
  );
}

function responseActionLabel(
  item: PlayerProjection["responseStack"][number],
): string {
  if (item.kind === "intelligence") return "传递情报";
  if (item.kind === "secretOrderWindow") return "秘密下达窗口";
  return item.cardName ?? "卡牌行动";
}

export function responseActionText(
  item: PlayerProjection["responseStack"][number],
  playerDisplayNames: Readonly<Record<string, string>>,
  transmissionMethod?: NonNullable<PlayerProjection["transmission"]>["method"],
): string {
  if (item.kind === "intelligence") {
    const sender = item.sourcePlayerId
      ? `【${playerDisplayNames[item.sourcePlayerId] ?? item.sourcePlayerId}】`
      : "";
    return `${sender}正在${transmissionMethod ? `以${transmissionMethod}` : ""}传递情报`;
  }
  return item.sourcePlayerId
    ? `【${playerDisplayNames[item.sourcePlayerId] ?? item.sourcePlayerId}】使用 ${responseActionLabel(item)}`
    : responseActionLabel(item);
}

export function responseFocusContextText(
  item: PlayerProjection["responseStack"][number],
  playerDisplayNames: Readonly<Record<string, string>>,
  transmission: PlayerProjection["transmission"],
  activePlayerId: string,
): string {
  if (item.kind === "intelligence" && transmission) {
    return `情报传递 · ${transmission.method}`;
  }
  if (transmission) {
    const sender = playerDisplayNames[transmission.senderId] ?? transmission.senderId;
    const recipient = playerDisplayNames[transmission.intendedRecipientId] ?? transmission.intendedRecipientId;
    return `情报路线 · ${sender} → ${recipient} · ${transmission.method}`;
  }
  return `当前回合 · ${playerDisplayNames[activePlayerId] ?? activePlayerId}`;
}

export function responseFocusActionText(
  item: PlayerProjection["responseStack"][number],
  playerDisplayNames: Readonly<Record<string, string>>,
  transmission: PlayerProjection["transmission"],
): string {
  if (item.kind === "intelligence" && transmission) {
    const sender = playerDisplayNames[transmission.senderId] ?? transmission.senderId;
    const recipient = playerDisplayNames[transmission.intendedRecipientId] ?? transmission.intendedRecipientId;
    return `${sender} → ${recipient}`;
  }
  return responseActionText(item, playerDisplayNames, transmission?.method);
}

function ResponsePanel({
  projection,
  playerDisplayNames,
  reactionTimer,
  offset,
  onOffsetChange,
}: {
  projection: PlayerProjection;
  playerDisplayNames: Readonly<Record<string, string>>;
  reactionTimer?: ReactionTimerSnapshot | null;
  offset: { x: number; y: number };
  onOffsetChange: (offset: { x: number; y: number }) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | undefined>(undefined);
  const stack = projection.responseStack;
  const current = stack.at(-1);
  if (!projection.reactionWindow || !current) return null;
  const currentResponder = projection.reactionWindow.currentResponderId;
  const focusContext = responseFocusContextText(
    current,
    playerDisplayNames,
    projection.transmission,
    projection.activePlayerId,
  );
  const focusAction = responseFocusActionText(
    current,
    playerDisplayNames,
    projection.transmission,
  );
  const showSeparateTarget = current.kind !== "intelligence" || !projection.transmission;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const margin = 8;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      minX: offset.x + margin - rect.left,
      maxX: offset.x + window.innerWidth - margin - rect.right,
      minY: offset.y + margin - rect.top,
      maxY: offset.y + window.innerHeight - margin - rect.bottom,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    onOffsetChange({
      x: Math.min(active.maxX, Math.max(active.minX, active.originX + event.clientX - active.startX)),
      y: Math.min(active.maxY, Math.max(active.minY, active.originY + event.clientY - active.startY)),
    });
  };

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      className="table-focus-panel table-focus-panel--response response-panel"
      aria-label="当前响应"
      data-game-animation-anchor="response"
      ref={panelRef}
      style={{ "--response-offset-x": `${offset.x}px`, "--response-offset-y": `${offset.y}px` } as React.CSSProperties}
    >
      <div
        className="response-panel__heading"
        onDoubleClick={() => onOffsetChange({ x: 0, y: 0 })}
        onPointerCancel={stopDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        title="拖动调整位置；双击复位"
      >
        <span>当前响应 <i aria-hidden="true">⠿</i></span>
        <span className="response-panel__controls">
          {reactionTimer && <ReactionCountdown key={reactionTimer.promptId} timer={reactionTimer} />}
          {(offset.x !== 0 || offset.y !== 0) && (
            <button
              aria-label="复位当前响应位置"
              onClick={() => onOffsetChange({ x: 0, y: 0 })}
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              title="复位位置"
              type="button"
            >
              复位
            </button>
          )}
        </span>
      </div>
      <p className="response-panel__context">{focusContext}</p>
      <strong className="response-panel__action">{focusAction}</strong>
      {showSeparateTarget && (
        <span className="response-panel__target">
          目标：【{playerDisplayNames[current.targetPlayerId] ?? current.targetPlayerId}】
        </span>
      )}
      {stack.length > 1 && (
        <ol className="response-stack">
          {stack.map((item, index) => (
            <li className={index === stack.length - 1 ? "response-stack__current" : ""} key={item.id}>
              <span>{item.sourcePlayerId ? `【${playerDisplayNames[item.sourcePlayerId] ?? item.sourcePlayerId}】` : ""}{responseActionLabel(item)}</span>
              {index === stack.length - 1 && <em>← 当前动作</em>}
            </li>
          ))}
        </ol>
      )}
      <small>等待：【{playerDisplayNames[currentResponder] ?? currentResponder}】响应</small>
    </section>
  );
}

const ACTION_LABELS: Record<string, string> = {
  ACCEPT_INTELLIGENCE: "接收情报",
  DECLINE_INTELLIGENCE: "不接收",
  DISCARD_FOR_HAND_LIMIT: "弃牌",
  PLAY_TRANSFER: "转移",
  PASS_REACTION: "跳过反应",
  PASS_LOCK: "跳过反应",
  PLAY_LOCK: "锁定",
  PLAY_SWAP: "掉包",
  PLAY_LURE: "调虎离山",
  PLAY_DECRYPT: "破译",
  PLAY_SEPARATION: "离间",
  PLAY_INTERCEPT: "截获",
  PLAY_REINFORCEMENT: "增援",
  PLAY_CONFIDENTIAL_FILE: "机密文件",
  PLAY_BURN: "烧毁",
  PLAY_PROBE: "试探",
  CHOOSE_PROBE_IDENTITY: "选择试探方式",
  CHOOSE_PROBE_DISCARD: "选择弃牌",
  ENTER_TRANSMISSION_PHASE: "进入传情报阶段",
  PLAY_SECRET_ORDER: "秘密下达",
  PLAY_PUBLIC_TEXT: "公开文本",
  PLAY_DANGEROUS_INTELLIGENCE: "危险情报",
  PLAY_FUNCTION_SEPARATION: "离间",
  CHOOSE_DANGEROUS_DISCARD: "选择弃置",
  CHOOSE_PUBLIC_TEXT_EFFECT: "选择效果",
  CHOOSE_PUBLIC_TEXT_DISCARD: "弃置手牌",
  PLAY_COUNTER: "识破",
};

export { cardArtPath };
export {
  cardVariantText,
  compactCardMeta,
  privateNoticeVariantText,
  probeIdentityNoticeText,
  publicCardSummary,
};

export function factionBackgroundClass(faction: Faction): string {
  if (faction === "军情") return "game-shell--faction-intelligence";
  if (faction === "潜伏") return "game-shell--faction-undercover";
  return "game-shell--faction-agent";
}

export function seatOrderAnchoredAtPlayer(
  seatOrder: readonly string[],
  playerId: string,
): string[] {
  const anchorIndex = seatOrder.indexOf(playerId);
  if (anchorIndex < 0) throw new Error("当前玩家不在座位顺序中");
  return [...seatOrder.slice(anchorIndex), ...seatOrder.slice(0, anchorIndex)];
}

export function transmissionDirectionForSelection(
  mode: PlayerProjection["mode"],
  circle: boolean,
  direction: "clockwise" | "counterclockwise",
): "clockwise" | "counterclockwise" | undefined {
  return circle && mode !== "duel" ? direction : undefined;
}

export function transmissionPromptDescription(
  card: Pick<PhysicalCard, "circle" | "transmission">,
  method: PhysicalCard["transmission"],
  mode: PlayerProjection["mode"],
): string {
  const choices: string[] = [];
  if (card.transmission === "任意") choices.push("传递方式");
  if (method === "直达") choices.push("接收者");
  else if (card.circle && mode !== "duel") choices.push("传递方向");
  return choices.length > 0
    ? `请选择${choices.join("和")}。`
    : "确认后开始传递。";
}

interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function transmissionSlotRadius(
  viewportWidth: number,
  viewportHeight: number,
): number {
  return viewportWidth <= 850
    ? 100
    : Math.min(116, Math.max(100, viewportHeight * 0.13));
}

export function transmissionSlotPosition(
  ring: LayoutRect,
  recipient: LayoutRect,
  content: Pick<LayoutRect, "width" | "height">,
  radius: number,
): { left: number; top: number } {
  const ringCenterX = ring.left + ring.width / 2;
  const ringCenterY = ring.top + ring.height / 2;
  const recipientCenterX = recipient.left + recipient.width / 2;
  const recipientCenterY = recipient.top + recipient.height / 2;
  const deltaX = recipientCenterX - ringCenterX;
  const deltaY = recipientCenterY - ringCenterY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const anchorX = ring.width / 2 + deltaX / distance * radius;
  const anchorY = ring.height / 2 + deltaY / distance * radius;
  return {
    left: Math.round(anchorX - content.width / 2),
    top: Math.round(anchorY - content.height / 2),
  };
}

export function soleSelectableTransmissionCardId(
  hand: readonly Pick<PhysicalCard, "id">[],
  selectableCardIds: ReadonlySet<string>,
): string | undefined {
  const eligibleIds = hand
    .filter((card) => selectableCardIds.has(card.id))
    .map((card) => card.id);
  return eligibleIds.length === 1 ? eligibleIds[0] : undefined;
}

export function inspectedHandForProjection(
  projection: PlayerProjection,
): PhysicalCard[] {
  return projection.activeFunctionAction?.inspectedHand ??
    projection.pendingSecretOrder?.inspectedHand ??
    [];
}

export function publicTextReceiptEffect(card: PhysicalCard): string | undefined {
  if (card.name !== "公开文本") return undefined;
  if (card.variant?.kind === "publicTextBlack") {
    return `${card.variant.mandatoryDrawFaction}必须摸 1 张；其他阵营选择摸 1 张或摸 2 张`;
  }
  if (card.variant?.kind === "publicTextColor" && card.color === "红") {
    return "潜伏必须弃 1 张；军情／特工选择摸 1 张或弃 1 张";
  }
  if (card.variant?.kind === "publicTextColor" && card.color === "蓝") {
    return "军情必须弃 1 张；潜伏／特工选择摸 1 张或弃 1 张";
  }
  return undefined;
}

function CardDetailDialog({ card, onClose }: { card: PhysicalCard; onClose: () => void }) {
  const receiptEffect = publicTextReceiptEffect(card);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="card-detail-backdrop" onPointerDown={onClose} role="presentation">
      <section
        aria-label={`${card.name}详情`}
        aria-modal="true"
        className={`card-detail-dialog${receiptEffect ? " card-detail-dialog--with-note" : ""}`}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="关闭卡牌详情"
          autoFocus
          className="card-detail-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <div className="card-detail-card">
          <CardView card={card} />
        </div>
        {receiptEffect && (
          <section className="receipt-effect-detail">
            <strong>作为情报收到后</strong>
            <p>{receiptEffect}</p>
            <small>先检查死亡；存活时再结算此效果。</small>
          </section>
        )}
      </section>
    </div>
  );
}

function probeVariantLabel(card: PhysicalCard | undefined): string | undefined {
  if (card?.variant?.kind === "probeIdentity") return "身份代码";
  if (card?.variant?.kind === "probeDrawDiscard") {
    return `${card.variant.drawFaction}摸牌／其他阵营弃牌`;
  }
  return undefined;
}

function actionCardId(action: ProjectedLegalAction): string | undefined {
  return "cardId" in action ? action.cardId : undefined;
}

function actionTargetId(action: ProjectedLegalAction): string | undefined {
  if ("targetId" in action) return action.targetId;
  if ("targetPlayerId" in action && typeof action.targetPlayerId === "string") {
    return action.targetPlayerId;
  }
  return undefined;
}

export function actionDetail(
  action: ProjectedLegalAction,
  projection: PlayerProjection,
  playerDisplayNames: Readonly<Record<string, string>>,
): string {
  const targetId = actionTargetId(action);
  const target = targetId && projection.players.some((player) => player.id === targetId)
    ? (playerDisplayNames[targetId] ?? targetId)
    : undefined;
  if (action.type === "PLAY_BURN") {
    const targetCard = projection.players
      .find((player) => player.id === action.targetPlayerId)
      ?.intelligence.find((card) => card.id === action.targetIntelligenceCardId);
    return `烧毁 → ${playerDisplayNames[action.targetPlayerId] ?? action.targetPlayerId} 的${targetCard ? `「${targetCard.name}」` : "情报"}`;
  }
  if (action.type === "PLAY_PROBE") {
    const card = projection.own.hand.find((candidate) => candidate.id === action.cardId);
    const variant = probeVariantLabel(card);
    return `试探${variant ? `（${variant}）` : ""}${target ? ` → ${target}` : ""}`;
  }
  if (action.type === "PLAY_SECRET_ORDER") {
    const card = projection.own.hand.find(
      (candidate) => candidate.id === action.cardId,
    );
    const color = card?.variant?.kind === "secretOrder"
      ? card.variant.mapping[action.word]
      : undefined;
    return color ? `秘密下达：${color}` : "秘密下达";
  }
  if (
    action.type === "PLAY_LOCK" &&
    requiresLockCardSelection(projection.legalActions, projection.own.hand)
  ) {
    const card = projection.own.hand.find((candidate) => candidate.id === action.cardId);
    return card ? `使用锁定（${card.color} · ${card.transmission}）` : "使用锁定";
  }
  if (action.type === "CHOOSE_PROBE_IDENTITY") {
    return action.choice === "announce" ? "公开身份代码" : "随机交出一张手牌";
  }
  if (target) return `${ACTION_LABELS[action.type] ?? action.type} → ${target}`;
  if (action.type === "CHOOSE_PUBLIC_TEXT_EFFECT") {
    return action.choice === "drawOne" ? "摸一张牌" : action.choice === "drawTwo" ? "摸两张牌" : "弃置一张手牌";
  }
  return ACTION_LABELS[action.type] ?? action.type;
}

export function promptTitle(projection: PlayerProjection): string {
  const actions = projection.legalActions;
  if (
    projection.phase === "preTransmission" &&
    projection.pendingSecretOrder?.stage === "selection" &&
    projection.activePlayerId === projection.own.id &&
    !projection.reactionWindow
  ) {
    if (
      projection.pendingSecretOrder.requiredColor &&
      !projection.pendingSecretOrder.verifiedNoMatch
    ) {
      return `秘密下达要求：请选择${projection.pendingSecretOrder.requiredColor}色情报`;
    }
    return "请选择要传递的情报";
  }
  if (actions.length === 0) return "等待其他玩家操作";
  if (actions.some((action) => action.type === "DISCARD_FOR_HAND_LIMIT")) return "手牌超过 7 张，请先弃牌";
  if (actions.some((action) => action.type === "PASS_LOCK")) return "是否锁定这份情报？";
  if (
    projection.reactionWindow?.kind === "intelligence" &&
    actions.some((action) => action.type === "ACCEPT_INTELLIGENCE")
  ) {
    return "轮到你响应并决定是否接收情报";
  }
  if (actions.some((action) => action.type === "PASS_REACTION")) return "轮到你响应";
  if (actions.some((action) => action.type === "ACCEPT_INTELLIGENCE")) return "是否接收这份情报？";
  if (actions.some((action) => action.type === "CHOOSE_PUBLIC_TEXT_EFFECT")) return "选择公开文本效果";
  if (actions.some((action) => action.type === "CHOOSE_DANGEROUS_DISCARD")) return "选择要弃置的手牌";
  return projection.activePlayerId === projection.own.id ? "你的行动阶段" : "请选择操作";
}

export function promptDescription(
  projection: PlayerProjection,
  selectedCardId?: string,
): string {
  const actions = projection.legalActions;
  if (
    projection.phase === "preTransmission" &&
    projection.pendingSecretOrder?.stage === "selection" &&
    projection.activePlayerId === projection.own.id &&
    !projection.reactionWindow
  ) {
    return "请选择一张高亮情报牌；选中后再确认传递方式和目标。";
  }
  if (actions.length === 0) return "当前无需操作，状态变化后会自动更新。";
  if (requiresLockCardSelection(actions, projection.own.hand)) {
    const selectedLock = actions.some(
      (action) => action.type === "PLAY_LOCK" && action.cardId === selectedCardId,
    );
    return selectedLock
      ? "已选择锁定牌；确认使用，或改选另一张高亮牌。"
      : "请选择一张高亮的锁定牌，或跳过反应。";
  }
  if (projection.reactionWindow) return "可使用高亮手牌，或选择下方的可用操作。";
  if (actions.some((action) => action.type === "DISCARD_FOR_HAND_LIMIT")) {
    return "请选择一张高亮手牌完成弃置。";
  }
  if (projection.activePlayerId === projection.own.id) {
    return "选择可用操作；需要手牌时请点击高亮牌。";
  }
  return "请选择一项可用操作。";
}

export function isSecondaryPromptAction(action: ProjectedLegalAction): boolean {
  return action.type.startsWith("PASS_") || action.type === "DECLINE_INTELLIGENCE";
}

const KEYBOARD_CONFIRM_EXCLUDED_ACTIONS = new Set<ProjectedLegalAction["type"]>([
  "DISCARD_FOR_HAND_LIMIT",
  "CHOOSE_DANGEROUS_DISCARD",
  "CHOOSE_PROBE_DISCARD",
  "CHOOSE_PUBLIC_TEXT_DISCARD",
  "ACCEPT_INTELLIGENCE",
  "ENTER_TRANSMISSION_PHASE",
]);

const DISCARD_CONFIRM_ACTION_TYPES = new Set<ProjectedLegalAction["type"]>([
  "DISCARD_FOR_HAND_LIMIT",
  "CHOOSE_DANGEROUS_DISCARD",
  "CHOOSE_PROBE_DISCARD",
  "CHOOSE_PUBLIC_TEXT_DISCARD",
]);

export function keyboardConfirmAction(
  primaryActions: readonly ProjectedLegalAction[],
): ProjectedLegalAction | undefined {
  if (primaryActions.length !== 1) return undefined;
  const action = primaryActions[0];
  return action && !KEYBOARD_CONFIRM_EXCLUDED_ACTIONS.has(action.type)
    ? action
    : undefined;
}

export function keyboardDiscardAction(
  actions: readonly ProjectedLegalAction[],
  selectedCardId?: string,
): ProjectedLegalAction | undefined {
  if (!selectedCardId) return undefined;
  const matching = actions.filter(
    (action) =>
      DISCARD_CONFIRM_ACTION_TYPES.has(action.type) &&
      actionCardId(action) === selectedCardId,
  );
  return matching.length === 1 ? matching[0] : undefined;
}

const DEDICATED_ACTION_SHORTCUTS: Partial<
  Record<ProjectedLegalAction["type"], string>
> = {
  ACCEPT_INTELLIGENCE: "A",
  DISCARD_FOR_HAND_LIMIT: "D",
  CHOOSE_DANGEROUS_DISCARD: "D",
  CHOOSE_PROBE_DISCARD: "D",
  CHOOSE_PUBLIC_TEXT_DISCARD: "D",
  ENTER_TRANSMISSION_PHASE: "T",
  PLAY_LOCK: "L",
  PLAY_SWAP: "R",
  PLAY_COUNTER: "C",
  PLAY_INTERCEPT: "I",
  PLAY_BURN: "B",
  PLAY_LURE: "U",
  PLAY_SEPARATION: "O",
  PLAY_FUNCTION_SEPARATION: "O",
  PLAY_DECRYPT: "P",
  PLAY_REINFORCEMENT: "F",
  PLAY_CONFIDENTIAL_FILE: "G",
};

export function dedicatedActionShortcut(
  action: ProjectedLegalAction,
): string | undefined {
  if (action.type === "CHOOSE_PROBE_IDENTITY") {
    return action.choice === "announce" ? "Q" : "W";
  }
  if (action.type === "CHOOSE_PUBLIC_TEXT_EFFECT") {
    return action.choice === "drawOne" ? "Q" : "W";
  }
  if (action.type === "PLAY_SECRET_ORDER") {
    return {
      听风: "Q",
      看雨: "W",
      日落: "E",
    }[action.word];
  }
  return DEDICATED_ACTION_SHORTCUTS[action.type];
}

export function keyboardPromptOptionAction(
  actions: readonly ProjectedLegalAction[],
  key: string,
): ProjectedLegalAction | undefined {
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
  return actions.find(
    (action) =>
      (
        action.type === "CHOOSE_PROBE_IDENTITY" ||
        action.type === "CHOOSE_PUBLIC_TEXT_EFFECT"
      ) &&
      dedicatedActionShortcut(action) === normalizedKey,
  );
}

export function keyboardCardShortcutAction(
  actions: readonly ProjectedLegalAction[],
  type:
    | "PLAY_LOCK"
    | "PLAY_SWAP"
    | "PLAY_COUNTER"
    | "PLAY_INTERCEPT"
    | "PLAY_BURN"
    | "PLAY_LURE"
    | "PLAY_DECRYPT"
    | "PLAY_REINFORCEMENT"
    | "PLAY_CONFIDENTIAL_FILE",
  selectedCardId?: string,
): ProjectedLegalAction | undefined {
  const matching = actions.filter((action) => action.type === type);
  if (selectedCardId) {
    const selected = matching.filter(
      (action) => actionCardId(action) === selectedCardId,
    );
    if (selected.length === 1) return selected[0];
    if (selected.length > 1) return undefined;
  }
  return matching.length === 1 ? matching[0] : undefined;
}

export function keyboardSeparationShortcutAction(
  actions: readonly ProjectedLegalAction[],
  selectedCardId?: string,
): ProjectedLegalAction | undefined {
  const separationActions = actions.filter(
    (action) =>
      action.type === "PLAY_SEPARATION" ||
      action.type === "PLAY_FUNCTION_SEPARATION",
  );
  if (selectedCardId) {
    const selected = separationActions.filter(
      (action) => actionCardId(action) === selectedCardId,
    );
    if (selected.length === 1) return selected[0];
    if (selected.length > 1) return undefined;
  }
  return separationActions.length === 1 ? separationActions[0] : undefined;
}

export function keyboardSecretOrderCardId(
  actions: readonly ProjectedLegalAction[],
  selectedCardId?: string,
): string | undefined {
  const cardIds = [
    ...new Set(
      actions
        .filter((action) => action.type === "PLAY_SECRET_ORDER")
        .map((action) => action.cardId),
    ),
  ];
  if (selectedCardId && cardIds.includes(selectedCardId as PhysicalCardId)) {
    return selectedCardId;
  }
  return cardIds.length === 1 ? cardIds[0] : undefined;
}

export function keyboardSecretOrderAction(
  actions: readonly ProjectedLegalAction[],
  selectedCardId: string | undefined,
  word: SecretOrderWord,
): ProjectedLegalAction | undefined {
  const cardId = keyboardSecretOrderCardId(actions, selectedCardId);
  return cardId
    ? actions.find(
        (action) =>
          action.type === "PLAY_SECRET_ORDER" &&
          action.cardId === cardId &&
          action.word === word,
      )
    : undefined;
}

function shouldHandleKeyboardShortcut(
  target: EventTarget | null,
  intent: { type: string },
): boolean {
  if (!(target instanceof HTMLElement)) return true;
  return shouldHandleGameShortcutFromElement(intent, {
    tagName: target.tagName,
    isContentEditable: target.isContentEditable,
    classNames: [...target.classList],
  });
}

const REACTION_WINDOW_LABELS: Record<ProjectedReactionKind, string> = {
  intelligence: "情报传递",
  transfer: "转移",
  lock: "锁定",
  swap: "掉包",
  lure: "调虎离山",
  decrypt: "破译",
  burn: "烧毁",
  function: "功能牌",
  secretOrder: "秘密下达",
};

const RECEIPT_STAGE_LABELS: Record<ProjectedReceiptStage, string> = {
  lockOffer: "等待是否锁定",
  reactions: "等待情报响应",
  decision: "等待接收决定",
};

export function reactionWindowLabel(kind: ProjectedReactionKind): string {
  return REACTION_WINDOW_LABELS[kind];
}

export function receiptStageLabel(stage: ProjectedReceiptStage): string {
  return RECEIPT_STAGE_LABELS[stage];
}

export function promptActions(
  actions: readonly ProjectedLegalAction[],
  selectedCardId?: string,
  hand: readonly PhysicalCard[] = [],
): ProjectedLegalAction[] {
  const lockActions = actions.filter(
    (action): action is Extract<ProjectedLegalAction, { type: "PLAY_LOCK" }> =>
      action.type === "PLAY_LOCK",
  );
  const selectedLock = lockActions.find((action) => action.cardId === selectedCardId);
  const directLock = requiresLockCardSelection(actions, hand)
    ? selectedLock
    : (selectedLock ?? lockActions[0]);

  return actions.filter((action) => {
    if (action.type === "START_TRANSMISSION") return false;
    const cardId = actionCardId(action);
    if (!cardId) return true;
    if (action.type === "PLAY_LOCK") return action === directLock;
    return cardId === selectedCardId && !actionTargetId(action);
  });
}

export function requiresLockCardSelection(
  actions: readonly ProjectedLegalAction[],
  hand: readonly PhysicalCard[] = [],
): boolean {
  const lockActions = actions.filter(
    (action): action is Extract<ProjectedLegalAction, { type: "PLAY_LOCK" }> =>
      action.type === "PLAY_LOCK",
  );
  if (lockActions.length <= 1) return false;

  const choices = new Set(lockActions.map((action) => {
    const card = hand.find((candidate) => candidate.id === action.cardId);
    return card
      ? `${card.color}|${card.transmission}|${card.circle}|${card.unburnable}`
      : action.cardId;
  }));
  return choices.size > 1;
}

export function mergeAuditLogs(
  gameEntries: readonly string[],
  orderedEvents: readonly PublicAuditEvent[] = [],
): string[] {
  if (orderedEvents.length === 0) return [...gameEntries];
  return [...orderedEvents]
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.text);
}

export function formatAuditEntries(
  entries: readonly string[],
  playerDisplayNames: Readonly<Record<string, string>>,
): string[] {
  return entries.map((entry) =>
    Object.entries(playerDisplayNames).reduce(
      (formatted, [playerId, displayName]) =>
        formatted.split(playerId).join(`【${displayName}】`),
      entry,
    ),
  );
}

export function auditEntryInvolvesPlayer(
  entry: string,
  playerId: string,
  displayName?: string,
): boolean {
  return entry.includes(playerId) || Boolean(displayName && entry.includes(displayName));
}

export function updateIdentityMarkers(
  markers: Readonly<Record<string, Faction>>,
  playerId: string,
  marker: IdentityMarker,
): Record<string, Faction> {
  if (marker) return { ...markers, [playerId]: marker };
  const updated = { ...markers };
  delete updated[playerId];
  return updated;
}

export function privateNoticeText(
  notice: PlayerProjection["privateNotices"][number],
  playerDisplayNames: Readonly<Record<string, string>>,
): string {
  const otherPlayer = playerDisplayNames[notice.otherPlayerId] ?? notice.otherPlayerId;
  if (notice.kind === "secretOrderHandInspected") {
    return `你通过秘密下达查看了【${otherPlayer}】的手牌：`;
  }
  if (notice.kind === "dangerousHandInspected") {
    return `你通过危险情报查看了【${otherPlayer}】的手牌：`;
  }
  if (notice.kind === "publicTextGained") {
    return `你从【${otherPlayer}】手中取得了这张牌：`;
  }
  if (notice.kind === "publicTextLost") {
    return `【${otherPlayer}】通过公开文本从你手中取得了这张牌：`;
  }
  if (notice.kind === "dangerousDiscardLost") {
    return `【${otherPlayer}】通过危险情报从你手中弃置了这张牌：`;
  }
  if (notice.kind === "dangerousDiscardMade") {
    return `你通过危险情报从【${otherPlayer}】手中弃置了这张牌：`;
  }
  if (notice.kind === "probePlayed") {
    return `你对【${otherPlayer}】使用的试探详情：`;
  }
  if (notice.kind === "probeReceived") {
    return `【${otherPlayer}】对你使用的试探详情：`;
  }
  if (notice.kind === "secretOrderPlayed") {
    return `你对【${otherPlayer}】使用的秘密下达详情：`;
  }
  return `【${otherPlayer}】对你使用的秘密下达详情：`;
}

export function GameTable({
  projection,
  playerDisplayNames = {},
  connected,
  busy = false,
  errorMessage,
  reactionTimer,
  isHost = false,
  reactionTimeoutSeconds,
  autoPassDelayMs,
  soundEnabled,
  publicAuditEvents = [],
  chatMessages = [],
  playerReactions = [],
  spectators = [],
  disconnectedLivingPlayers = [],
  onReactionTimeoutChange,
  onAutoPassDelayChange,
  onSoundEnabledChange,
  onMarkDisconnectedPlayerDead,
  onSetBotTakeover,
  onNewGame,
  onSendChat,
  onPlayerReaction,
  onCommand,
}: GameTableProps) {
  const [selectedCardId, setSelectedCardId] = useState<string>();
  const selectedCardContext = useRef<string | undefined>(undefined);
  const autoSelectedTransmissionContext = useRef<string | undefined>(undefined);
  const [autoPassNoAction, setAutoPassNoAction] = useState(loadAutoPassPreference);
  const [autoPassIgnoreBurn, setAutoPassIgnoreBurn] = useState(loadAutoPassIgnoreBurnPreference);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(
    loadKeyboardShortcutsPreference,
  );
  const lastAutoPassPrompt = useRef<string | undefined>(undefined);
  const pendingAutoPassTimer = useRef<number | undefined>(undefined);
  const [transmissionMethod, setTransmissionMethod] = useState<"密电" | "文本" | "直达">("密电");
  const [direction, setDirection] = useState<"clockwise" | "counterclockwise">("clockwise");
  const [discardPileOpen, setDiscardPileOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<PhysicalCard>();
  const [privateNoticesCollapsed, setPrivateNoticesCollapsed] = useState(false);
  const [responsePanelOffset, setResponsePanelOffset] = useState({ x: 0, y: 0 });
  const [auditPlayerFilter, setAuditPlayerFilter] = useState("");
  const [identityMarkers, setIdentityMarkers] = useState<Record<string, Faction>>({});
  const [reactionTargetId, setReactionTargetId] = useState<string>();
  const [handOverflow, setHandOverflow] = useState({ left: false, right: false });
  const auditLogRef = useRef<HTMLOListElement>(null);
  const auditLogFollowsLatest = useRef(true);
  const handRowRef = useRef<HTMLDivElement>(null);
  const handCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const playerRingRef = useRef<HTMLDivElement>(null);
  const transmissionSlotRef = useRef<HTMLDivElement>(null);
  const transmissionMotionRef = useRef<HTMLDivElement>(null);
  const previousTransmissionPosition = useRef<{
    recipientId: string;
    x: number;
    y: number;
  } | undefined>(undefined);
  const transmissionAnimation = useRef<Animation | undefined>(undefined);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const chatBubbles = usePlayerChatBubbles(chatMessages);
  const actions = projection.legalActions;
  const transmissionActions = actions.filter(
    (action): action is StartTransmissionAction =>
      action.type === "START_TRANSMISSION",
  );
  const selectionContext = [
    projection.phase,
    projection.activePlayerId,
    projection.reactionWindow?.kind,
    projection.reactionWindow?.currentResponderId,
    projection.responseStack.at(-1)?.id,
    projection.transmission?.intendedRecipientId,
    projection.transmission?.receiptStage,
    projection.pendingSecretOrder?.stage,
    projection.activeFunctionAction?.stage,
  ].join("|");
  const activeSelectedCardId = selectedCardContext.current === selectionContext
    ? selectedCardId
    : undefined;
  const playableCardIds = useMemo(() => new Set(actions.map(actionCardId).filter((id): id is string => Boolean(id))), [actions]);
  const selectedActions = activeSelectedCardId ? actions.filter((action) => actionCardId(action) === activeSelectedCardId) : [];
  const visiblePromptActions = promptActions(actions, activeSelectedCardId, projection.own.hand);
  const primaryPromptActions = visiblePromptActions.filter((action) => !isSecondaryPromptAction(action));
  const secondaryPromptActions = visiblePromptActions.filter(isSecondaryPromptAction);
  const keyboardPrimaryAction = keyboardConfirmAction(primaryPromptActions);
  const keyboardAcceptAction = actions.find(
    (action): action is Extract<GameCommand, { type: "ACCEPT_INTELLIGENCE" }> =>
      action.type === "ACCEPT_INTELLIGENCE",
  );
  const keyboardDeclineAction = actions.find(
    (action): action is Extract<GameCommand, { type: "DECLINE_INTELLIGENCE" }> =>
      action.type === "DECLINE_INTELLIGENCE",
  );
  const keyboardSelectedDiscardAction = keyboardDiscardAction(
    actions,
    activeSelectedCardId,
  );
  const keyboardPassReactionAction = actions.find(
    (action): action is Extract<GameCommand, { type: "PASS_REACTION" }> =>
      action.type === "PASS_REACTION",
  );
  const keyboardPassLockAction = actions.find(
    (action): action is Extract<GameCommand, { type: "PASS_LOCK" }> =>
      action.type === "PASS_LOCK",
  );
  const keyboardLockAction = keyboardCardShortcutAction(
    actions,
    "PLAY_LOCK",
    activeSelectedCardId,
  );
  const keyboardSwapAction = keyboardCardShortcutAction(
    actions,
    "PLAY_SWAP",
    activeSelectedCardId,
  );
  const keyboardCounterAction = keyboardCardShortcutAction(
    actions,
    "PLAY_COUNTER",
    activeSelectedCardId,
  );
  const keyboardInterceptAction = keyboardCardShortcutAction(
    actions,
    "PLAY_INTERCEPT",
    activeSelectedCardId,
  );
  const keyboardBurnAction = keyboardCardShortcutAction(
    actions,
    "PLAY_BURN",
    activeSelectedCardId,
  );
  const keyboardLureAction = keyboardCardShortcutAction(
    actions,
    "PLAY_LURE",
    activeSelectedCardId,
  );
  const keyboardSeparationAction = keyboardSeparationShortcutAction(
    actions,
    activeSelectedCardId,
  );
  const keyboardDecryptAction = keyboardCardShortcutAction(
    actions,
    "PLAY_DECRYPT",
    activeSelectedCardId,
  );
  const keyboardReinforcementAction = keyboardCardShortcutAction(
    actions,
    "PLAY_REINFORCEMENT",
    activeSelectedCardId,
  );
  const keyboardConfidentialFileAction = keyboardCardShortcutAction(
    actions,
    "PLAY_CONFIDENTIAL_FILE",
    activeSelectedCardId,
  );
  const keyboardSecretOrderSelectionId = keyboardSecretOrderCardId(
    actions,
    activeSelectedCardId,
  );
  const keyboardEnterTransmissionPhaseAction = actions.find(
    (action): action is Extract<GameCommand, { type: "ENTER_TRANSMISSION_PHASE" }> =>
      action.type === "ENTER_TRANSMISSION_PHASE",
  );
  const inspectedHand = inspectedHandForProjection(projection);
  const selectedBurnActions = activeSelectedCardId
    ? (actions as readonly GameCommand[]).filter(
        (action): action is BurnCommand =>
          action.type === "PLAY_BURN" && action.cardId === activeSelectedCardId,
      )
    : [];
  const selectedCard = projection.own.hand.find((card) => card.id === activeSelectedCardId);
  const canStartTransmission = transmissionActions.length > 0;
  const compactMobilePrompt = !canStartTransmission && visiblePromptActions.length === 1;
  const selectableCardIds = new Set(playableCardIds);
  const selectCard = useCallback((cardId: string | undefined) => {
    selectedCardContext.current = cardId ? selectionContext : undefined;
    setSelectedCardId(cardId);
  }, [selectionContext]);

  useEffect(() => {
    selectedCardContext.current = undefined;
    setSelectedCardId(undefined);
  }, [selectionContext]);

  useEffect(() => {
    if (!canStartTransmission) {
      autoSelectedTransmissionContext.current = undefined;
      return;
    }
    if (
      autoSelectedTransmissionContext.current === selectionContext ||
      activeSelectedCardId
    ) {
      return;
    }
    const soleCardId = soleSelectableTransmissionCardId(
      projection.own.hand,
      selectableCardIds,
    );
    if (!soleCardId) return;
    autoSelectedTransmissionContext.current = selectionContext;
    selectCard(soleCardId);
  }, [
    activeSelectedCardId,
    canStartTransmission,
    projection.own.hand,
    selectCard,
    selectableCardIds,
    selectionContext,
  ]);

  useEffect(() => {
    if (activeSelectedCardId && !selectableCardIds.has(activeSelectedCardId)) {
      selectedCardContext.current = undefined;
      setSelectedCardId(undefined);
    }
  }, [activeSelectedCardId, selectableCardIds]);

  const updateHandOverflow = useCallback(() => {
    const handRow = handRowRef.current;
    if (!handRow) return;
    const next = horizontalOverflowIndicators(
      handRow.scrollLeft,
      handRow.clientWidth,
      handRow.scrollWidth,
    );
    setHandOverflow((current) =>
      current.left === next.left && current.right === next.right
        ? current
        : next
    );
  }, []);

  useEffect(() => {
    const handRow = handRowRef.current;
    if (!handRow) return;
    updateHandOverflow();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(updateHandOverflow);
    resizeObserver?.observe(handRow);
    window.addEventListener("resize", updateHandOverflow);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHandOverflow);
    };
  }, [projection.own.hand.length, updateHandOverflow]);

  useEffect(() => {
    if (!activeSelectedCardId) return;
    handCardRefs.current.get(activeSelectedCardId)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    const frame = window.requestAnimationFrame(updateHandOverflow);
    return () => window.cancelAnimationFrame(frame);
  }, [activeSelectedCardId, updateHandOverflow]);

  const selectedTransmissionActions = selectedCard
    ? transmissionActions.filter((action) => action.cardId === selectedCard.id)
    : [];
  const availableTransmissionMethods = new Set(
    selectedTransmissionActions.map((action) => action.method),
  );
  const effectiveMethod = selectedCard?.transmission === "任意"
    ? availableTransmissionMethods.has(transmissionMethod)
      ? transmissionMethod
      : selectedTransmissionActions[0]?.method
    : selectedCard?.transmission;
  const selectedMethodTransmissionActions = effectiveMethod
    ? selectedTransmissionActions.filter((action) => action.method === effectiveMethod)
    : [];
  const directTransmissionTargetIds = effectiveMethod === "直达"
    ? selectedMethodTransmissionActions
        .map((action) => action.targetId)
        .filter((targetId): targetId is string => Boolean(targetId))
    : [];
  const selectedDirection = transmissionDirectionForSelection(
    projection.mode,
    selectedCard?.circle ?? false,
    direction,
  );
  const routeTransmissionCommand = effectiveMethod && effectiveMethod !== "直达"
    ? selectedMethodTransmissionActions.find(
        (action) => action.direction === selectedDirection,
      )
    : undefined;
  const keyboardTransmissionCommand: GameCommand | undefined =
    effectiveMethod === "直达"
      ? directTransmissionTargetIds.length === 1
        ? selectedMethodTransmissionActions.find(
            (action) => action.targetId === directTransmissionTargetIds[0],
          )
        : undefined
      : routeTransmissionCommand;
  const keyboardConfirmCommand: GameCommand | undefined =
    keyboardPrimaryAction ?? keyboardTransmissionCommand;
  const targetIds = new Set([
    ...selectedActions
      .filter((action) => action.type !== "PLAY_BURN")
      .map(actionTargetId)
      .filter((id): id is string => Boolean(id)),
    ...directTransmissionTargetIds,
  ]);
  const mergedAuditEntries = mergeAuditLogs(projection.auditLog, publicAuditEvents);
  const auditEntries = mergedAuditEntries
    .map((entry, index) => ({
      index,
      text: formatAuditEntries([entry], playerDisplayNames)[0]!,
    }))
    .filter(({ index }) =>
      !auditPlayerFilter || auditEntryInvolvesPlayer(
        mergedAuditEntries[index]!,
        auditPlayerFilter,
        playerDisplayNames[auditPlayerFilter],
      )
    );

  useEffect(() => {
    const log = auditLogRef.current;
    if (!log || !auditLogFollowsLatest.current) return;
    log.scrollTop = log.scrollHeight;
  }, [auditEntries.length]);
  const displaySeatOrder = useMemo(
    () => seatOrderAnchoredAtPlayer(projection.seatOrder, projection.own.id),
    [projection.own.id, projection.seatOrder],
  );
  const transmissionRecipientIndex = projection.transmission
    ? displaySeatOrder.indexOf(projection.transmission.intendedRecipientId)
    : -1;
  const transmissionRecipientId = projection.transmission?.intendedRecipientId;
  const transmissionSenderId = projection.transmission?.senderId;

  useLayoutEffect(() => {
    const ring = playerRingRef.current;
    const slot = transmissionSlotRef.current;
    const motion = transmissionMotionRef.current;
    if (!ring || !slot || !motion || !transmissionRecipientId) return;

    const placeSlot = () => {
      const recipient = Array.from(
        ring.querySelectorAll<HTMLElement>("[data-game-animation-player-id]"),
      ).find((element) =>
        element.dataset.gameAnimationPlayerId === transmissionRecipientId
      );
      if (!recipient) return;
      const position = transmissionSlotPosition(
        ring.getBoundingClientRect(),
        recipient.getBoundingClientRect(),
        { width: motion.offsetWidth, height: motion.offsetHeight },
        transmissionSlotRadius(window.innerWidth, window.innerHeight),
      );
      slot.style.left = `${position.left}px`;
      slot.style.top = `${position.top}px`;
    };

    placeSlot();
    const resizeObserver = new ResizeObserver(placeSlot);
    resizeObserver.observe(ring);
    resizeObserver.observe(motion);
    window.addEventListener("resize", placeSlot);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", placeSlot);
    };
  }, [displaySeatOrder.length, transmissionRecipientId]);

  useLayoutEffect(() => {
    const slot = transmissionSlotRef.current;
    const motion = transmissionMotionRef.current;
    if (!slot || !motion || !transmissionRecipientId || !transmissionSenderId) {
      previousTransmissionPosition.current = undefined;
      transmissionAnimation.current?.cancel();
      transmissionAnimation.current = undefined;
      return;
    }

    const bounds = slot.getBoundingClientRect();
    const current = {
      recipientId: transmissionRecipientId,
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    const previous = previousTransmissionPosition.current;
    previousTransmissionPosition.current = current;
    const sender = !previous
      ? Array.from(
          document.querySelectorAll<HTMLElement>("[data-game-animation-player-id]"),
        )
          .find((element) =>
            element.dataset.gameAnimationPlayerId === transmissionSenderId
          )
          ?.querySelector<HTMLElement>(".player-reaction-trigger")
      : undefined;
    const senderBounds = sender?.getBoundingClientRect();
    const origin = previous ?? (senderBounds
      ? {
          recipientId: transmissionSenderId,
          x: senderBounds.left + senderBounds.width / 2,
          y: senderBounds.top + senderBounds.height / 2,
        }
      : undefined);
    if (
      !origin ||
      (previous && previous.recipientId === current.recipientId) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    transmissionAnimation.current?.cancel();
    const animation = motion.animate(
      [
        {
          transform: `translate(${origin.x - current.x}px, ${origin.y - current.y}px)`,
        },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(.22,.76,.25,1)",
      },
    );
    transmissionAnimation.current = animation;
    void animation.finished.then(() => {
      if (transmissionAnimation.current !== animation) return;
      animation.cancel();
      transmissionAnimation.current = undefined;
    }).catch(() => undefined);
  }, [transmissionRecipientId, transmissionSenderId]);
  const autoPassAction = automaticPassCommand(actions, autoPassIgnoreBurn);
  const autoPassPrompt = reactionTimer?.promptId ?? (
    projection.reactionWindow
      ? `${projection.reactionWindow.kind}:${projection.reactionWindow.currentResponderId}:${projection.auditLog.length}`
      : projection.transmission?.receiptStage === "lockOffer"
        ? `lock:${projection.transmission.senderId}:${projection.transmission.intendedRecipientId}:${projection.auditLog.length}`
        : undefined
  );

  const cancelPendingAutoPass = useCallback(() => {
    if (pendingAutoPassTimer.current === undefined) return;
    window.clearTimeout(pendingAutoPassTimer.current);
    pendingAutoPassTimer.current = undefined;
  }, []);

  const dispatchCommand = useCallback((command: GameCommand) => {
    cancelPendingAutoPass();
    if (autoPassPrompt) lastAutoPassPrompt.current = autoPassPrompt;
    onCommand(command);
  }, [autoPassPrompt, cancelPendingAutoPass, onCommand]);

  useEffect(() => {
    if (!autoPassPrompt) {
      cancelPendingAutoPass();
      lastAutoPassPrompt.current = undefined;
      return;
    }
    if (
      !autoPassNoAction ||
      !connected ||
      busy ||
      !autoPassAction ||
      lastAutoPassPrompt.current === autoPassPrompt
    ) {
      return;
    }
    lastAutoPassPrompt.current = autoPassPrompt;
    const delayMs = automaticPassDelayMs(autoPassAction, projection.own.hand.length, autoPassDelayMs);
    if (delayMs === 0) {
      onCommand(autoPassAction);
      return;
    }
    const timeout = window.setTimeout(() => {
      if (pendingAutoPassTimer.current === timeout) {
        pendingAutoPassTimer.current = undefined;
      }
      onCommand(autoPassAction);
    }, delayMs);
    pendingAutoPassTimer.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (pendingAutoPassTimer.current === timeout) {
        pendingAutoPassTimer.current = undefined;
      }
    };
  }, [autoPassAction, autoPassDelayMs, autoPassNoAction, autoPassPrompt, busy, cancelPendingAutoPass, connected, onCommand, projection.own.hand.length]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (
        !keyboardShortcutsEnabled ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }
      const transmissionOptionIndex = transmissionOptionShortcutIndex(event.key);
      const transmissionTargetId = transmissionOptionIndex === undefined
        ? undefined
        : directTransmissionTargetIds[transmissionOptionIndex];
      const promptOptionAction = keyboardPromptOptionAction(actions, event.key);
      const intent = transmissionTargetId
        ? { type: "chooseTransmissionRecipient", targetId: transmissionTargetId } as const
        : promptOptionAction
          ? { type: "choosePromptOption", action: promptOptionAction } as const
        : gameShortcutIntent(event.key);
      if (!intent) return;

      if (intent.type === "cancel") {
        if (detailCard) {
          event.preventDefault();
          setDetailCard(undefined);
          return;
        }
        if (discardPileOpen) {
          event.preventDefault();
          setDiscardPileOpen(false);
          return;
        }
        if (settingsRef.current?.open) {
          event.preventDefault();
          settingsRef.current.removeAttribute("open");
          return;
        }
        if (reactionTargetId) {
          event.preventDefault();
          setReactionTargetId(undefined);
          return;
        }
      }

      if (intent.type === "toggleDiscardPile") {
        if (discardPileOpen) {
          event.preventDefault();
          setDiscardPileOpen(false);
          return;
        }
        if (
          !shouldHandleKeyboardShortcut(event.target, intent) ||
          detailCard
        ) {
          return;
        }
        event.preventDefault();
        setDiscardPileOpen((open) => !open);
        return;
      }

      if (intent.type === "togglePrivateNotices") {
        if (
          !shouldHandleKeyboardShortcut(event.target, intent) ||
          detailCard ||
          discardPileOpen ||
          projection.privateNotices.length === 0
        ) {
          return;
        }
        event.preventDefault();
        setPrivateNoticesCollapsed((collapsed) => !collapsed);
        return;
      }

      if (
        !shouldHandleKeyboardShortcut(event.target, intent) ||
        detailCard ||
        discardPileOpen ||
        busy ||
        !connected
      ) {
        return;
      }

      if (intent.type === "chooseTransmissionRecipient") {
        if (!selectedCard || effectiveMethod !== "直达") return;
        event.preventDefault();
        dispatchCommand({
          type: "START_TRANSMISSION",
          cardId: selectedCard.id as PhysicalCardId,
          method: effectiveMethod,
          targetId: intent.targetId,
        });
        return;
      }
      if (intent.type === "choosePromptOption") {
        event.preventDefault();
        dispatchCommand(intent.action);
        return;
      }

      if (intent.type === "selectCard") {
        const card = projection.own.hand[intent.index];
        if (!card || !selectableCardIds.has(card.id)) return;
        event.preventDefault();
        selectCard(card.id === activeSelectedCardId ? undefined : card.id);
        return;
      }
      if (intent.type === "moveCard") {
        const nextCardId = nextSelectableCardId(
          projection.own.hand.map((card) => card.id),
          selectableCardIds,
          activeSelectedCardId,
          intent.direction,
        );
        if (!nextCardId) return;
        event.preventDefault();
        selectCard(nextCardId);
        return;
      }
      if (intent.type === "confirm" && keyboardConfirmCommand) {
        event.preventDefault();
        dispatchCommand(keyboardConfirmCommand);
        return;
      }
      if (intent.type === "acceptIntelligence" && keyboardAcceptAction) {
        event.preventDefault();
        dispatchCommand(keyboardAcceptAction);
        return;
      }
      if (
        intent.type === "declineIntelligence" &&
        (keyboardSelectedDiscardAction || keyboardDeclineAction)
      ) {
        event.preventDefault();
        dispatchCommand(keyboardSelectedDiscardAction ?? keyboardDeclineAction!);
        return;
      }
      if (
        intent.type === "passWindow" &&
        (keyboardPassReactionAction || keyboardPassLockAction)
      ) {
        event.preventDefault();
        dispatchCommand(keyboardPassReactionAction ?? keyboardPassLockAction!);
        return;
      }
      if (intent.type === "playLock" && keyboardLockAction) {
        event.preventDefault();
        dispatchCommand(keyboardLockAction);
        return;
      }
      if (intent.type === "playSwap" && keyboardSwapAction) {
        event.preventDefault();
        dispatchCommand(keyboardSwapAction);
        return;
      }
      if (intent.type === "playCounter" && keyboardCounterAction) {
        event.preventDefault();
        dispatchCommand(keyboardCounterAction);
        return;
      }
      if (intent.type === "playIntercept" && keyboardInterceptAction) {
        event.preventDefault();
        dispatchCommand(keyboardInterceptAction);
        return;
      }
      if (intent.type === "playBurn" && keyboardBurnAction) {
        event.preventDefault();
        dispatchCommand(keyboardBurnAction);
        return;
      }
      if (intent.type === "playLure" && keyboardLureAction) {
        event.preventDefault();
        dispatchCommand(keyboardLureAction);
        return;
      }
      if (intent.type === "playSeparation" && keyboardSeparationAction) {
        event.preventDefault();
        dispatchCommand(keyboardSeparationAction);
        return;
      }
      if (intent.type === "playDecrypt" && keyboardDecryptAction) {
        event.preventDefault();
        dispatchCommand(keyboardDecryptAction);
        return;
      }
      if (intent.type === "playReinforcement" && keyboardReinforcementAction) {
        event.preventDefault();
        dispatchCommand(keyboardReinforcementAction);
        return;
      }
      if (
        intent.type === "playConfidentialFile" &&
        keyboardConfidentialFileAction
      ) {
        event.preventDefault();
        dispatchCommand(keyboardConfidentialFileAction);
        return;
      }
      if (
        intent.type === "selectSecretOrder" &&
        keyboardSecretOrderSelectionId
      ) {
        event.preventDefault();
        selectCard(keyboardSecretOrderSelectionId);
        return;
      }
      if (intent.type === "playSecretOrder") {
        const secretOrderAction = keyboardSecretOrderAction(
          actions,
          activeSelectedCardId,
          intent.word,
        );
        if (!secretOrderAction) return;
        event.preventDefault();
        dispatchCommand(secretOrderAction);
        return;
      }
      if (
        intent.type === "enterTransmissionPhase" &&
        keyboardEnterTransmissionPhaseAction
      ) {
        event.preventDefault();
        dispatchCommand(keyboardEnterTransmissionPhaseAction);
        return;
      }
      if (intent.type === "cancel" && activeSelectedCardId) {
        event.preventDefault();
        selectCard(undefined);
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [
    activeSelectedCardId,
    busy,
    connected,
    detailCard,
    discardPileOpen,
    dispatchCommand,
    keyboardAcceptAction,
    keyboardConfirmCommand,
    keyboardConfidentialFileAction,
    keyboardDeclineAction,
    keyboardDecryptAction,
    keyboardEnterTransmissionPhaseAction,
    keyboardLockAction,
    keyboardPassLockAction,
    keyboardPassReactionAction,
    keyboardReinforcementAction,
    keyboardSelectedDiscardAction,
    keyboardSecretOrderSelectionId,
    keyboardCounterAction,
    keyboardBurnAction,
    keyboardInterceptAction,
    keyboardLureAction,
    keyboardSeparationAction,
    keyboardSwapAction,
    keyboardShortcutsEnabled,
    directTransmissionTargetIds,
    effectiveMethod,
    selectedCard,
    actions,
    projection.own.hand,
    projection.privateNotices.length,
    reactionTargetId,
    selectCard,
    selectableCardIds,
  ]);

  const chooseTarget = (targetId: string) => {
    const matches = selectedActions.filter((action) => actionTargetId(action) === targetId);
    if (matches.length === 1) {
      dispatchCommand(matches[0]);
    }
  };

  return (
    <main className={`game-shell ${factionBackgroundClass(projection.own.faction)}`}>
      <header className="game-topbar">
        <div className="game-brand">
          <div className="game-brand__title">
            <strong>风声</strong>
            <span>{projection.mode === "duel" ? "双人模式" : "标准模式"}</span>
          </div>
          <div className="game-round-meta">
            <span data-game-animation-anchor="deck">牌堆 <b>{projection.drawPileCount}</b></span>
            <DiscardPileButton
              cards={projection.publicDiscard}
              hiddenCardCount={projection.hiddenDiscardCount}
              onOpen={() => setDiscardPileOpen(true)}
              removedProbeCount={projection.removedProbeCount}
              shortcutLabel={keyboardShortcutsEnabled ? "K" : undefined}
            />
          </div>
        </div>
        <div className="game-status">
          <span className="game-status-chip">
            旁观 {spectators.filter((spectator) => spectator.connected).length}
          </span>
          <span className={`game-status-chip ${connected ? "online-dot" : "offline-dot"}`}>
            {connected ? "● 已连接" : "● 连接中断，游戏暂停"}
          </span>
          <details className="game-settings" ref={settingsRef}>
            <summary>⚙ 游戏设置</summary>
            <div className="game-settings__popover">
              <button
                aria-pressed={soundEnabled}
                className="sound-toggle"
                onClick={() => onSoundEnabledChange(!soundEnabled)}
                title={soundEnabled ? "关闭游戏音效" : "开启游戏音效"}
                type="button"
              >
                {soundEnabled ? "🔊 音效已开启" : "🔇 音效已关闭"}
              </button>
              <section className="keyboard-shortcut-settings">
                <label className="auto-pass-control">
                  <input
                    checked={keyboardShortcutsEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setKeyboardShortcutsEnabled(checked);
                      try {
                        localStorage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, String(checked));
                      } catch {
                        // The preference remains active for this page when storage is unavailable.
                      }
                    }}
                    type="checkbox"
                  />
                  启用键盘快捷键
                </label>
                <details className="keyboard-shortcut-reference">
                  <summary>查看键盘快捷键</summary>
                  <div className="keyboard-shortcut-reference__panel">
                    <div aria-label="键盘快捷键说明" className="keyboard-shortcut-groups">
                      <section className="keyboard-shortcut-group">
                        <h4>通用</h4>
                        <dl>
                          <div><dt><kbd>1–9</kbd></dt><dd>选择手牌</dd></div>
                          <div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>切换可用手牌</dd></div>
                          <div><dt><kbd>Enter</kbd></dt><dd>确认唯一主要操作</dd></div>
                          <div><dt><kbd>K</kbd></dt><dd>打开／关闭弃牌堆</dd></div>
                          <div><dt><kbd>N</kbd></dt><dd>展开／收起私人通知</dd></div>
                          <div><dt><kbd>Esc</kbd></dt><dd>取消选择或关闭弹窗</dd></div>
                        </dl>
                      </section>
                      <section className="keyboard-shortcut-group">
                        <h4>流程</h4>
                        <dl>
                          <div><dt><kbd>T</kbd></dt><dd>进入情报传递阶段</dd></div>
                          <div><dt><kbd>S</kbd></dt><dd>跳过当前窗口</dd></div>
                          <div><dt><kbd>QWERTYU</kbd></dt><dd>选择直达接收者</dd></div>
                        </dl>
                      </section>
                      <section className="keyboard-shortcut-group">
                        <h4>决定</h4>
                        <dl>
                          <div><dt><kbd>A</kbd></dt><dd>接受情报</dd></div>
                          <div><dt><kbd>D</kbd></dt><dd>不接收情报／确认弃牌</dd></div>
                          <div><dt><kbd>Q</kbd><kbd>W</kbd></dt><dd>选择公开文本／试探选项</dd></div>
                        </dl>
                      </section>
                      <section className="keyboard-shortcut-group keyboard-shortcut-group--function">
                        <h4>功能牌</h4>
                        <dl>
                          <div><dt><kbd>L</kbd></dt><dd>锁定</dd></div>
                          <div><dt><kbd>F</kbd></dt><dd>增援</dd></div>
                          <div><dt><kbd>G</kbd></dt><dd>机密文件</dd></div>
                          <div><dt><kbd>R</kbd></dt><dd>掉包</dd></div>
                          <div><dt><kbd>I</kbd></dt><dd>截获</dd></div>
                          <div><dt><kbd>U</kbd></dt><dd>调虎离山</dd></div>
                          <div><dt><kbd>P</kbd></dt><dd>破译</dd></div>
                          <div><dt><kbd>B</kbd></dt><dd>烧毁（目标唯一时）</dd></div>
                          <div><dt><kbd>O</kbd></dt><dd>离间（目标唯一时）</dd></div>
                          <div><dt><kbd>C</kbd></dt><dd>识破</dd></div>
                          <div><dt><kbd>M</kbd></dt><dd>选择秘密下达</dd></div>
                          <div>
                            <dt><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd></dt>
                            <dd>听风 / 看雨 / 日落</dd>
                          </div>
                        </dl>
                      </section>
                    </div>
                    <small>输入聊天消息或操作表单时，快捷键会自动停用。</small>
                  </div>
                </details>
              </section>
              <label className="auto-pass-control">
                <input
                  checked={autoPassNoAction}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAutoPassNoAction(checked);
                    try {
                      localStorage.setItem(AUTO_PASS_STORAGE_KEY, String(checked));
                    } catch {
                      // The preference remains active for this page when storage is unavailable.
                    }
                  }}
                  type="checkbox"
                />
                无可用反应或锁定时自动跳过
              </label>
              <label className="auto-pass-control">
                <input
                  checked={autoPassIgnoreBurn}
                  disabled={!autoPassNoAction}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAutoPassIgnoreBurn(checked);
                    try {
                      localStorage.setItem(AUTO_PASS_IGNORE_BURN_STORAGE_KEY, String(checked));
                    } catch {
                      // The preference remains active for this page when storage is unavailable.
                    }
                  }}
                  type="checkbox"
                />
                自动跳过时忽略烧毁
              </label>
              {isHost && (
                <label className="table-timeout-control">
                  <span>反应时限</span>
                  <select
                    disabled={busy || !connected}
                    onChange={(event) => onReactionTimeoutChange(Number(event.target.value) as ReactionTimeoutSeconds)}
                    value={reactionTimeoutSeconds}
                  >
                    {REACTION_TIMEOUT_OPTIONS.map((seconds) => (
                      <option key={seconds} value={seconds}>{seconds === 0 ? "关闭" : `${seconds} 秒`}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="table-timeout-control">
                <span>我的自动跳过等待</span>
                <select
                  onChange={(event) => onAutoPassDelayChange(Number(event.target.value) as AutoPassDelayMs)}
                  value={autoPassDelayMs}
                >
                  {AUTO_PASS_DELAY_OPTIONS_MS.map((milliseconds) => (
                    <option key={milliseconds} value={milliseconds}>
                      {milliseconds === 0 ? "立即" : `${milliseconds / 1_000} 秒`}
                    </option>
                  ))}
                </select>
              </label>
              {spectators.some((spectator) => spectator.connected) && (
                <small>
                  旁观者：{spectators.filter((spectator) => spectator.connected).map((spectator) => spectator.displayName).join("、")}
                </small>
              )}
            </div>
          </details>
          {isHost && disconnectedLivingPlayers.map((player) => (
            <span className="disconnected-player-actions" key={player.id}>
              <button
                className="ai-takeover-button"
                disabled={busy || !connected}
                onClick={() => onSetBotTakeover(player.id, !player.botControlled)}
                type="button"
              >
                {player.botControlled
                  ? `取消机器人接管 ${player.displayName}`
                  : `让机器人接管 ${player.displayName}`}
              </button>
              <button
                className="mark-dead-button"
                disabled={busy || !connected}
                onClick={() => {
                  if (window.confirm(`确定将已断线的 ${player.displayName} 判定为死亡吗？此操作会进行正常死亡结算。`)) {
                    onMarkDisconnectedPlayerDead(player.id);
                  }
                }}
                type="button"
              >
                将 {player.displayName} 判定死亡
              </button>
            </span>
          ))}
        </div>
      </header>

      {errorMessage && <div className="game-error" role="alert">{errorMessage}</div>}
      {projection.winner && (
        <div className="winner-banner">
          <span>游戏结束 · 胜者：{projection.winner.kind === "faction" ? projection.winner.faction : playerDisplayNames[projection.winner.playerId] ?? projection.winner.playerId}</span>
          {isHost
            ? <button disabled={busy || !connected} onClick={onNewGame} type="button">新游戏</button>
            : <small>等待房主开始新游戏</small>}
        </div>
      )}

      <section className="game-layout">
        <div className="table-area">
          <div
            className="player-ring"
            data-game-animation-anchor="table"
            ref={playerRingRef}
          >
            {displaySeatOrder.map((id, index) => {
              const player = projection.players.find((candidate) => candidate.id === id)!;
              const isOwn = id === projection.own.id;
              const isTarget = targetIds.has(id);
              return (
                <article
                  className={`table-player${isOwn ? " table-player--own" : ""}${player.alive ? "" : " table-player--dead"}${projection.activePlayerId === id ? " table-player--active" : ""}${projection.reactionWindow?.currentResponderId === id ? " table-player--responder" : ""}`}
                  data-game-animation-player-id={id}
                  key={id}
                  style={{ "--player-index": index, "--player-count": displaySeatOrder.length } as React.CSSProperties}
                >
                  <PlayerChatBubble message={chatBubbles[id]} />
                  <button
                    aria-expanded={reactionTargetId === id}
                    aria-label={isOwn ? "你的头像" : `与${playerDisplayNames[id] ?? id}互动`}
                    className="player-reaction-trigger"
                    data-reaction-source-player-id={id}
                    disabled={isOwn || busy || !connected}
                    onClick={() => setReactionTargetId((current) =>
                      current === id ? undefined : id
                    )}
                    title={isOwn ? "你的头像" : "点击送花或扔番茄"}
                    type="button"
                  >
                    <span aria-hidden="true">👤</span>
                  </button>
                  {reactionTargetId === id && !isOwn && (
                    <PlayerReactionMenu
                      canChooseGameTarget={isTarget}
                      disabled={busy || !connected}
                      onChooseGameTarget={() => {
                        setReactionTargetId(undefined);
                        chooseTarget(id);
                      }}
                      onClose={() => setReactionTargetId(undefined)}
                      onReact={(kind) => {
                        setReactionTargetId(undefined);
                        onPlayerReaction(kind, id);
                      }}
                      targetName={playerDisplayNames[id] ?? id}
                    />
                  )}
                  <button className="player-card" disabled={!isTarget || busy || !connected} onClick={() => chooseTarget(id)} type="button">
                  <strong data-reaction-target-player-id={id}>
                    {playerDisplayNames[id] ?? id}{isOwn ? "（你）" : ""}
                  </strong>
                    <span>{player.alive ? `${player.handCount} 张手牌` : "已死亡"}</span>
                    {player.faction && <span className="faction-badge">{player.faction}</span>}
                    {isTarget && <em>选择为目标</em>}
                  </button>
                  {!isOwn && !player.faction && (
                    <select
                      aria-label={`标记${playerDisplayNames[id] ?? id}的推测身份`}
                      className={`identity-marker${identityMarkers[id] ? ` identity-marker--${identityMarkers[id] === "军情" ? "intelligence" : identityMarkers[id] === "潜伏" ? "undercover" : "agent"}` : ""}`}
                      onChange={(event) => {
                        const marker = event.target.value as IdentityMarker;
                        setIdentityMarkers((current) => updateIdentityMarkers(current, id, marker));
                      }}
                      title="仅自己可见的推测身份"
                      value={identityMarkers[id] ?? ""}
                    >
                      <option value="">身份？</option>
                      <option value="军情">军情</option>
                      <option value="潜伏">潜伏</option>
                      <option value="特工">特工</option>
                    </select>
                  )}
                  <div
                    className={`intel-row${player.intelligence.length > 4 ? " intel-row--dense" : ""}`}
                    aria-label={`${playerDisplayNames[id] ?? id} 的情报`}
                    data-game-animation-intelligence-player-id={id}
                  >
                    {player.intelligence.map((card) => {
                      const burnAction = selectedBurnActions.find(
                        (action) => action.targetPlayerId === id && action.targetIntelligenceCardId === card.id,
                      );
                      return (
                        <CardView
                          artwork="accepted"
                          card={card}
                          displayTransmission={player.intelligenceMethods?.[card.id]}
                          key={card.id}
                          playable={Boolean(burnAction)}
                          inspectable={!burnAction}
                          onClick={burnAction
                            ? !busy && connected
                              ? () => dispatchCommand(burnAction)
                              : undefined
                            : () => setDetailCard(card)}
                        />
                      );
                    })}
                    {player.intelligence.length === 0 && <span>暂无情报</span>}
                  </div>
                </article>
              );
            })}

            {projection.transmission && transmissionRecipientIndex >= 0 && (
              <div
                aria-label="待传递情报"
                className="transmission-card-slot"
                data-transmission-recipient-id={projection.transmission.intendedRecipientId}
                ref={transmissionSlotRef}
                style={{
                  "--player-index": transmissionRecipientIndex,
                  "--player-count": displaySeatOrder.length,
                } as React.CSSProperties}
              >
                <div className="transmission-card-motion" ref={transmissionMotionRef}>
                  {!projection.reactionWindow && (
                    <small className="transmission-route-summary">
                      {playerDisplayNames[projection.transmission.senderId] ?? projection.transmission.senderId}
                      {" → "}
                      {playerDisplayNames[projection.transmission.intendedRecipientId] ?? projection.transmission.intendedRecipientId}
                      {" · "}
                      {projection.transmission.method}
                      {" · "}
                      {projection.transmission.locked
                        ? "已锁定"
                        : receiptStageLabel(projection.transmission.receiptStage)}
                    </small>
                  )}
                  {projection.transmission.card
                    ? <>
                        <CardView
                          card={projection.transmission.card}
                          inspectable={projection.transmission.card.name === "公开文本"}
                          key={projection.transmission.card.id}
                          onClick={projection.transmission.card.name === "公开文本"
                            ? () => setDetailCard(projection.transmission!.card)
                            : undefined}
                        />
                        {publicTextReceiptEffect(projection.transmission.card) && (
                          <small className="transmission-receipt-summary">
                            收到后：{publicTextReceiptEffect(projection.transmission.card)}
                          </small>
                        )}
                      </>
                    : (
                        <div
                          aria-label={projection.transmission.method === "密电" ? "未公开密电" : "未公开情报"}
                          className="hidden-card"
                          role="img"
                          title={projection.transmission.method === "密电" ? "未公开密电" : "未公开情报"}
                        >
                          <HiddenIntelligenceArtwork method={projection.transmission.method} />
                        </div>
                      )}
                </div>
              </div>
            )}

            {projection.reactionWindow ? (
              <ResponsePanel
                offset={responsePanelOffset}
                onOffsetChange={setResponsePanelOffset}
                playerDisplayNames={playerDisplayNames}
                projection={projection}
                reactionTimer={reactionTimer}
              />
            ) : shouldShowIdleFocusPanel(projection) ? (
              <section aria-label="当前回合" className="table-focus-panel table-center">
                <p className="table-center__eyebrow">当前回合</p>
                <strong>{playerDisplayNames[projection.activePlayerId] ?? projection.activePlayerId}</strong>
              </section>
            ) : null}
          </div>

          <section
            aria-live="polite"
            className={`prompt-panel action-dock ${
              actions.length > 0 || canStartTransmission ? "action-dock--decision" : "action-dock--passive"
            }${projection.reactionWindow ? " action-dock--reaction" : ""}${
              compactMobilePrompt ? " action-dock--single-action" : ""
            }`}
          >
            <div className="action-dock__copy">
              <p>
                {projection.reactionWindow
                  ? `响应窗口：${reactionWindowLabel(projection.reactionWindow.kind)}`
                  : "行动提示"}
                {!projection.reactionWindow && reactionTimer && <ReactionCountdown key={reactionTimer.promptId} timer={reactionTimer} />}
              </p>
              <h2>
                {canStartTransmission && selectedCard
                  ? `传递【${selectedCard.name}】`
                  : promptTitle(projection)}
              </h2>
              <small>
                {canStartTransmission && selectedCard && effectiveMethod
                  ? transmissionPromptDescription(
                      selectedCard,
                      effectiveMethod,
                      projection.mode,
                    )
                  : promptDescription(projection, activeSelectedCardId)}
              </small>
            </div>
            <div className="prompt-actions">
              {canStartTransmission && selectedCard && effectiveMethod && (
                <div
                  aria-label="情报传递选项"
                  className={`transmission-composer${effectiveMethod === "直达" ? " transmission-composer--targets" : ""}`}
                  role="group"
                >
                  {selectedCard.transmission === "任意" && (
                    <select
                      aria-label="传递方式"
                      onChange={(event) => setTransmissionMethod(event.target.value as typeof transmissionMethod)}
                      value={transmissionMethod}
                    >
                      {(["密电", "直达", "文本"] as const)
                        .filter((method) => availableTransmissionMethods.has(method))
                        .map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                    </select>
                  )}
                  {projection.mode !== "duel" && selectedCard.circle && effectiveMethod !== "直达" && (
                    <select
                      aria-label="传递方向"
                      onChange={(event) => setDirection(event.target.value as typeof direction)}
                      value={direction}
                    >
                      <option value="clockwise">顺时针</option>
                      <option value="counterclockwise">逆时针</option>
                    </select>
                  )}
                  {effectiveMethod === "直达" ? projection.players
                    .filter((player) => directTransmissionTargetIds.includes(player.id))
                    .map((player, index) => (
                      <button
                        disabled={busy || !connected}
                        key={player.id}
                        onClick={() => {
                          const command = selectedMethodTransmissionActions.find(
                            (action) => action.targetId === player.id,
                          );
                          if (command) dispatchCommand(command);
                        }}
                        type="button"
                      >
                        {playerDisplayNames[player.id] ?? player.id}
                        {keyboardShortcutsEnabled && TRANSMISSION_OPTION_KEYS[index] && (
                          <kbd className="action-shortcut-badge">
                            {TRANSMISSION_OPTION_KEYS[index].toUpperCase()}
                          </kbd>
                        )}
                      </button>
                    )) : (
                    <button
                      disabled={busy || !connected || !routeTransmissionCommand}
                      onClick={() => {
                        if (routeTransmissionCommand) {
                          dispatchCommand(routeTransmissionCommand);
                        }
                      }}
                      type="button"
                    >
                      开始传递
                      {keyboardShortcutsEnabled && keyboardTransmissionCommand && (
                        <kbd className="action-shortcut-badge">Enter</kbd>
                      )}
                    </button>
                  )}
                </div>
              )}
              {primaryPromptActions.length > 0 && (
                <div aria-label="主要操作" className="prompt-actions__group prompt-actions__group--primary" role="group">
                  {primaryPromptActions.map((action, index) => (
                    <button
                      className="prompt-action"
                      disabled={busy || !connected}
                      key={`${action.type}-${index}`}
                      onClick={() => dispatchCommand(action)}
                      type="button"
                    >
                      {actionDetail(action, projection, playerDisplayNames)}
                      {keyboardShortcutsEnabled &&
                        action === keyboardPrimaryAction &&
                        !dedicatedActionShortcut(action) && (
                        <kbd className="action-shortcut-badge">Enter</kbd>
                      )}
                      {keyboardShortcutsEnabled && dedicatedActionShortcut(action) && (
                        <kbd className="action-shortcut-badge">
                          {dedicatedActionShortcut(action)}
                        </kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {secondaryPromptActions.length > 0 && (
                <div aria-label="次要操作" className="prompt-actions__group prompt-actions__group--secondary" role="group">
                  {secondaryPromptActions.map((action, index) => (
                    <button
                      className="prompt-action prompt-action--secondary"
                      disabled={busy || !connected}
                      key={`${action.type}-${index}`}
                      onClick={() => dispatchCommand(action)}
                      type="button"
                    >
                      {actionDetail(action, projection, playerDisplayNames)}
                      {keyboardShortcutsEnabled && action.type === "DECLINE_INTELLIGENCE" && (
                        <kbd className="action-shortcut-badge">D</kbd>
                      )}
                      {keyboardShortcutsEnabled && action.type === "PASS_REACTION" && (
                        <kbd className="action-shortcut-badge">S</kbd>
                      )}
                      {keyboardShortcutsEnabled && action.type === "PASS_LOCK" && (
                        <kbd className="action-shortcut-badge">S</kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {projection.winner && (
            <FinalHandsPanel
              playerDisplayNames={playerDisplayNames}
              players={projection.players}
            />
          )}

          {projection.privateNotices.length > 0 && (
            <section className={`private-notices${privateNoticesCollapsed ? " private-notices--collapsed" : ""}`} aria-label="私人通知">
              <header>
                <h3>私人通知 <small>{projection.privateNotices.length}</small></h3>
                <button
                  aria-expanded={!privateNoticesCollapsed}
                  onClick={() => setPrivateNoticesCollapsed((collapsed) => !collapsed)}
                  type="button"
                >
                  {privateNoticesCollapsed ? "展开" : "收起"}
                  {keyboardShortcutsEnabled && (
                    <kbd className="action-shortcut-badge">N</kbd>
                  )}
                </button>
              </header>
              {!privateNoticesCollapsed && projection.privateNotices.map((notice, index) => (
                  <div
                    className="private-notice"
                    key={`${notice.kind}-${notice.otherPlayerId}-${index}`}
                  >
                    <p>{privateNoticeText(notice, playerDisplayNames)}</p>
                    {"cards" in notice ? (
                      <div className="hand-row">
                        {notice.cards.map((card) => (
                          <CardView card={card} key={card.id} noticeSummary />
                        ))}
                      </div>
                    ) : (
                      <CardView
                        card={notice.card}
                        noticeSummary
                        reverseProbeMapping={
                          notice.kind === "probePlayed" ||
                          notice.kind === "probeReceived"
                        }
                      />
                    )}
                  </div>
                ))}
            </section>
          )}

          {inspectedHand.length > 0 && (
            <section className="inspected-panel">
              <h3>查看到的手牌</h3>
              <div className="hand-row">
                {inspectedHand.map((card) => {
                  const action = actions.find((candidate) => actionCardId(candidate) === card.id);
                  return <CardView card={card} key={card.id} playable={Boolean(action)} onClick={action ? () => dispatchCommand(action) : undefined} />;
                })}
              </div>
            </section>
          )}

          <section className="own-area">
            <div className="own-area__header"><h2>你的手牌</h2><span>阵营：{projection.own.faction}</span></div>
            <div className="own-area__body">
              <div className={`own-hand-scroll${handOverflow.left ? " own-hand-scroll--left" : ""}${handOverflow.right ? " own-hand-scroll--right" : ""}`}>
                <div
                  className="hand-row own-hand-row"
                  data-game-animation-anchor="own-hand"
                  onScroll={updateHandOverflow}
                  ref={handRowRef}
                >
                  {projection.own.hand.length === 0 && <p className="empty-hand">暂无手牌</p>}
                  {projection.own.hand.map((card, index) => (
                    <CardView
                      buttonRef={(element) => {
                        if (element) handCardRefs.current.set(card.id, element);
                        else handCardRefs.current.delete(card.id);
                      }}
                      card={card}
                      key={card.id}
                      playable={selectableCardIds.has(card.id)}
                      selected={activeSelectedCardId === card.id}
                      shortcutLabel={
                        keyboardShortcutsEnabled && index < GAME_SHORTCUT_BINDINGS.cardKeys.length
                          ? GAME_SHORTCUT_BINDINGS.cardKeys[index]
                          : undefined
                      }
                      onClick={selectableCardIds.has(card.id) ? () => selectCard(card.id === activeSelectedCardId ? undefined : card.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <ResizableGameSidebar
          auditCount={auditEntries.length}
          auditPanel={<section className="audit-panel">
            <header>
              <h2>公开记录</h2>
              <label>
                <select
                  aria-label="按玩家筛选公开记录"
                  onChange={(event) => setAuditPlayerFilter(event.target.value)}
                  value={auditPlayerFilter}
                >
                  <option value="">全部玩家</option>
                  {projection.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerDisplayNames[player.id] ?? player.id}{player.id === projection.own.id ? "（你）" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </header>
            <ol
              onScroll={(event) => {
                const log = event.currentTarget;
                auditLogFollowsLatest.current = isNearScrollBottom(
                  log.scrollTop,
                  log.clientHeight,
                  log.scrollHeight,
                );
              }}
              ref={auditLogRef}
            >
              {auditEntries.map((entry) => (
                <li key={`${entry.text}-${entry.index}`} value={entry.index + 1}>{entry.text}</li>
              ))}
            </ol>
          </section>}
          chatPanel={<ChatPanel
            busy={busy}
            connected={connected}
            messages={chatMessages}
            onSend={onSendChat}
            playerDisplayNames={playerDisplayNames}
          />}
          chatCount={chatMessages.length}
        />
      </section>
      {discardPileOpen && (
        <DiscardPileDialog
          cards={projection.publicDiscard}
          hiddenCardCount={projection.hiddenDiscardCount}
          onClose={() => setDiscardPileOpen(false)}
          removedProbeCount={projection.removedProbeCount}
        />
      )}
      {detailCard && <CardDetailDialog card={detailCard} onClose={() => setDetailCard(undefined)} />}
      <PlayerReactionLayer
        events={playerReactions}
        playerDisplayNames={playerDisplayNames}
        soundEnabled={soundEnabled}
      />
      <GameEventAnimationLayer
        auditEntries={mergedAuditEntries}
        ownPlayerId={projection.own.id}
        playerIds={projection.players.map((player) => player.id)}
      />
    </main>
  );
}

export function shouldShowIdleFocusPanel(
  projection: Pick<PlayerProjection, "reactionWindow" | "transmission">,
): boolean {
  return !projection.reactionWindow && !projection.transmission;
}
