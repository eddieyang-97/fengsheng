import { useEffect } from "react";

import type { PhysicalCard } from "../game/cards";

function cardTone(card: PhysicalCard): string {
  return card.color === "红"
    ? "red"
    : card.color === "蓝"
      ? "blue"
      : card.color === "红蓝"
        ? "dual"
        : "black";
}

function variantText(card: PhysicalCard): string | undefined {
  const variant = card.variant;
  if (!variant) return undefined;
  if (variant.kind === "probeIdentity") {
    return `军情→${variant.mapping["军情"]} · 潜伏→${variant.mapping["潜伏"]} · 特工→${variant.mapping["特工"]}`;
  }
  if (variant.kind === "probeDrawDiscard") {
    return `${variant.drawFaction}摸1张；其他阵营弃1张`;
  }
  if (variant.kind === "secretOrder") {
    return `听风→${variant.mapping["听风"]} · 看雨→${variant.mapping["看雨"]} · 日落→${variant.mapping["日落"]}`;
  }
  if (variant.kind === "publicTextBlack") {
    return `${variant.mandatoryDrawFaction}摸1张`;
  }
  return undefined;
}

export function DiscardPileButton({
  cards,
  onOpen,
}: {
  cards: readonly PhysicalCard[];
  onOpen: () => void;
}) {
  return (
    <button className="discard-pile-button" onClick={onOpen} type="button">
      弃牌堆 {cards.length} · 查看
    </button>
  );
}

export function DiscardPileDialog({
  cards,
  onClose,
}: {
  cards: readonly PhysicalCard[];
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="discard-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-label="公开弃牌堆"
        aria-modal="true"
        className="discard-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div><p>公开信息</p><h2>弃牌堆 · {cards.length} 张</h2></div>
          <button autoFocus onClick={onClose} type="button">关闭</button>
        </header>
        {cards.length === 0 ? (
          <p className="discard-dialog-empty">弃牌堆目前为空。</p>
        ) : (
          <div className="discard-card-grid">
            {[...cards].reverse().map((card, index) => (
              <article className={`discard-card game-card game-card--${cardTone(card)}`} key={`${card.id}-${index}`}>
                <strong>{card.name}</strong>
                <span>{card.color} · {card.transmission}</span>
                {variantText(card) && <small>{variantText(card)}</small>}
                {card.circle && <small>可选方向</small>}
                {card.color === "黑" && card.unburnable && <small className="unburnable-badge">不可烧毁</small>}
              </article>
            ))}
          </div>
        )}
        <small className="discard-order-note">最新弃置的牌显示在最前。</small>
      </section>
    </div>
  );
}
