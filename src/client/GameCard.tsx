import type { Ref } from "react";

import type { PhysicalCard } from "../game/cards";
import { AcceptedIntelligenceArtwork, CardArtwork } from "./CardArtwork";

export function cardTone(card: PhysicalCard): string {
  return card.color === "红"
    ? "red"
    : card.color === "蓝"
      ? "blue"
      : card.color === "红蓝"
        ? "dual"
        : "black";
}

export function cardVariantText(card: PhysicalCard): string | undefined {
  const variant = card.variant;
  if (!variant) return undefined;
  if (variant.kind === "probeIdentity") {
    return `军情→${variant.mapping["军情"]}\n潜伏→${variant.mapping["潜伏"]}\n特工→${variant.mapping["特工"]}`;
  }
  if (variant.kind === "probeDrawDiscard") {
    return `${variant.drawFaction}摸 1 张；其他阵营弃 1 张`;
  }
  if (variant.kind === "secretOrder") {
    return `听风→${variant.mapping["听风"]}\n看雨→${variant.mapping["看雨"]}\n日落→${variant.mapping["日落"]}`;
  }
  return undefined;
}

export function probeIdentityNoticeText(card: PhysicalCard): string | undefined {
  const variant = card.variant;
  if (variant?.kind !== "probeIdentity") return undefined;
  return `${variant.mapping["军情"]}→军情\n${variant.mapping["潜伏"]}→潜伏\n${variant.mapping["特工"]}→特工`;
}

export function privateNoticeVariantText(
  card: PhysicalCard,
  reverseProbeMapping = false,
): string | undefined {
  return reverseProbeMapping
    ? probeIdentityNoticeText(card) ?? cardVariantText(card)
    : cardVariantText(card);
}

export function publicCardSummary(card: PhysicalCard): string {
  return `${card.name} · ${card.color} · ${card.transmission}`;
}

export function compactCardMeta(
  card: Pick<PhysicalCard, "color" | "transmission" | "unburnable">,
): string {
  const transmission = card.unburnable
    ? ({ 直达: "直", 密电: "密", 文本: "文", 任意: "任" } as const)[card.transmission]
    : card.transmission;
  return `${card.color}·${transmission}`;
}

export interface GameCardProps {
  card: PhysicalCard;
  className?: string;
  selected?: boolean;
  playable?: boolean;
  inspectable?: boolean;
  noticeSummary?: boolean;
  reverseProbeMapping?: boolean;
  artwork?: "card" | "accepted";
  shortcutLabel?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick?: () => void;
}

export function GameCard({
  card,
  className,
  selected,
  playable,
  inspectable,
  noticeSummary = false,
  reverseProbeMapping = false,
  artwork = "card",
  shortcutLabel,
  buttonRef,
  onClick,
}: GameCardProps) {
  const displayedVariantText = privateNoticeVariantText(
    card,
    noticeSummary && reverseProbeMapping,
  );
  return (
    <button
      className={`game-card game-card--${cardTone(card)}${card.unburnable ? " game-card--unburnable" : ""}${selected ? " game-card--selected" : ""}${playable ? " game-card--playable" : ""}${inspectable ? " game-card--inspectable" : ""}${className ? ` ${className}` : ""}`}
      disabled={!onClick}
      onClick={onClick}
      ref={buttonRef}
      title={`${publicCardSummary(card)}${card.unburnable ? " · 不可烧毁" : ""}`}
      type="button"
    >
      {artwork === "accepted"
        ? <AcceptedIntelligenceArtwork transmission={card.transmission} />
        : <CardArtwork cardName={card.name} />}
      {shortcutLabel && <kbd className="card-shortcut-badge">{shortcutLabel}</kbd>}
      <strong>{card.name}</strong>
      <span
        className="game-card__meta"
        data-color={card.color}
        data-compact-meta={compactCardMeta(card)}
        data-transmission={card.transmission}
      >
        {card.color} · {card.transmission}
      </span>
      {displayedVariantText && (
        <small className="game-card__variant">{displayedVariantText}</small>
      )}
      {card.circle && <small className="game-card__direction">可选方向</small>}
      {card.color === "黑" && card.unburnable && (
        <small className="unburnable-badge">不可烧毁</small>
      )}
    </button>
  );
}
