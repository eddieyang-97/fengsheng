import { useEffect } from "react";

import type { PhysicalCard } from "../game/cards";
import { GameCard } from "./GameCard";

export function DiscardPileButton({
  cards,
  onOpen,
  shortcutLabel,
}: {
  cards: readonly PhysicalCard[];
  onOpen: () => void;
  shortcutLabel?: string;
}) {
  return (
    <button className="discard-pile-button" onClick={onOpen} type="button">
      弃牌堆 {cards.length} · 查看
      {shortcutLabel && <kbd className="action-shortcut-badge">{shortcutLabel}</kbd>}
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
              <GameCard
                card={card}
                className="discard-card"
                key={`${card.id}-${index}`}
              />
            ))}
          </div>
        )}
        <small className="discard-order-note">最新弃置的牌显示在最前。</small>
      </section>
    </div>
  );
}
