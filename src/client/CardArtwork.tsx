import type { PhysicalCard } from "../game/cards";

const CARD_ART_SLUGS: Record<PhysicalCard["name"], string> = {
  公开文本: "public-text",
  试探: "probe",
  破译: "decrypt",
  烧毁: "burn",
  锁定: "lock",
  截获: "intercept",
  掉包: "swap",
  离间: "separation",
  秘密下达: "secret-order",
  调虎离山: "lure",
  危险情报: "dangerous-intelligence",
  识破: "counter",
  转移: "transfer",
  增援: "reinforcement",
  机密文件: "confidential-file",
};

export function cardArtPath(cardName: PhysicalCard["name"]): string {
  return `/card-art/${CARD_ART_SLUGS[cardName]}.png`;
}

export function CardArtwork({ cardName }: { cardName: PhysicalCard["name"] }) {
  return (
    <span
      aria-hidden="true"
      className="game-card__art"
      style={{ backgroundImage: `url("${cardArtPath(cardName)}")` }}
    />
  );
}
