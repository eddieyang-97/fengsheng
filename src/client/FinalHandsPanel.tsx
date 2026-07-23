import type { PhysicalCard } from "../game/cards";
import type { PublicPlayerProjection } from "../game/engine";

export interface FinalHandsPanelProps {
  players: readonly PublicPlayerProjection[];
  playerDisplayNames: Readonly<Record<string, string>>;
}

function cardTone(card: PhysicalCard): string {
  return card.color === "红"
    ? "red"
    : card.color === "蓝"
      ? "blue"
      : card.color === "红蓝"
        ? "dual"
        : "black";
}

export function FinalHandsPanel({
  players,
  playerDisplayNames,
}: FinalHandsPanelProps) {
  return (
    <section className="final-hands-panel" aria-label="终局手牌公开">
      <header>
        <p>游戏结束</p>
        <h2>终局手牌公开</h2>
      </header>
      <div className="final-hands-grid">
        {players.map((player) => (
          <section className="final-player-hand" key={player.id}>
            <h3>
              {playerDisplayNames[player.id] ?? player.id}
              <small>{player.hand?.length ?? 0} 张</small>
            </h3>
            <div className="final-hand-row">
              {player.hand?.map((card) => (
                <div
                  aria-label={`${card.name} · ${card.color} · ${card.transmission}`}
                  className={`final-hand-card final-hand-card--${cardTone(card)}`}
                  key={card.id}
                  title={`${card.name} · ${card.color} · ${card.transmission}`}
                >
                  <strong>{card.name}</strong>
                  <span>{card.color} · {card.transmission}</span>
                </div>
              ))}
              {(player.hand?.length ?? 0) === 0 && <span className="final-hand-empty">无剩余手牌</span>}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
