import { useEffect } from "react";

import type { PhysicalCard } from "../game/cards";
import { GameCard } from "./GameCard";

export function DiscardPileButton({
  cards,
  hiddenCardCount,
  onOpen,
  removedProbeCount,
  shortcutLabel,
}: {
  cards: readonly PhysicalCard[];
  hiddenCardCount: number;
  onOpen: () => void;
  removedProbeCount: number;
  shortcutLabel?: string;
}) {
  const totalDiscardCount = cards.length + hiddenCardCount;
  return (
    <button
      aria-label={`弃牌堆共${totalDiscardCount}张，其中暗置${hiddenCardCount}张；另有${removedProbeCount}张试探已移出游戏`}
      className="discard-pile-button"
      onClick={onOpen}
      type="button"
    >
      弃牌堆 {totalDiscardCount}（暗 {hiddenCardCount}）· 查看
      {shortcutLabel && <kbd className="action-shortcut-badge">{shortcutLabel}</kbd>}
    </button>
  );
}

export function DiscardPileDialog({
  cards,
  hiddenCardCount,
  onClose,
  removedProbeCount,
}: {
  cards: readonly PhysicalCard[];
  hiddenCardCount: number;
  onClose: () => void;
  removedProbeCount: number;
}) {
  const totalDiscardCount = cards.length + hiddenCardCount;
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
        aria-label="弃牌堆详情"
        aria-modal="true"
        className="discard-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div><p>公开与暗置信息</p><h2>弃牌堆 · {totalDiscardCount} 张</h2></div>
          <button autoFocus onClick={onClose} type="button">关闭</button>
        </header>
        <div className="discard-zone-summary" aria-label="弃牌区数量明细">
          <span>公开牌 <b>{cards.length}</b> 张</span>
          <span>暗置秘密下达 <b>{hiddenCardCount}</b> 张（可洗回）</span>
          <span>试探 <b>{removedProbeCount}</b> 张（已移出游戏）</span>
        </div>
        {cards.length === 0 ? (
          <p className="discard-dialog-empty">暂无可公开查看的弃牌。</p>
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
        {cards.length > 0 && (
          <small className="discard-order-note">最新弃置的公开牌显示在最前。</small>
        )}
      </section>
    </div>
  );
}
