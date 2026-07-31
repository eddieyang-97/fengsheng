import type { PhysicalCard } from "../game/cards";
import type { FixedTransmissionMethod } from "../game/engine";

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

export const HIDDEN_INTELLIGENCE_ART_PATH = "/card-art/hidden-intelligence.png";
export const HIDDEN_DIRECT_INTELLIGENCE_ART_PATH =
  "/card-art/hidden-direct-intelligence.png";
export const HIDDEN_SECRET_INTELLIGENCE_ART_PATH =
  "/card-art/hidden-secret-intelligence.png";
export const ACCEPTED_INTELLIGENCE_ART_PATH =
  "/card-art/accepted-intelligence.png";

export function CardArtwork({ cardName }: { cardName: PhysicalCard["name"] }) {
  return (
    <span
      aria-hidden="true"
      className="game-card__art"
      style={{ backgroundImage: `url("${cardArtPath(cardName)}")` }}
    />
  );
}

export function acceptedIntelligenceArtPath(
  transmission: PhysicalCard["transmission"],
): string {
  if (transmission === "直达") return HIDDEN_DIRECT_INTELLIGENCE_ART_PATH;
  if (transmission === "密电") return HIDDEN_SECRET_INTELLIGENCE_ART_PATH;
  if (transmission === "文本") return HIDDEN_INTELLIGENCE_ART_PATH;
  return ACCEPTED_INTELLIGENCE_ART_PATH;
}

export function AcceptedIntelligenceArtwork({
  transmission,
}: {
  transmission: PhysicalCard["transmission"];
}) {
  return (
    <span
      aria-hidden="true"
      className={`game-card__art game-card__art--accepted game-card__art--accepted-${
        transmission === "直达"
          ? "direct"
          : transmission === "密电"
            ? "secret"
            : transmission === "文本"
              ? "text"
              : "flexible"
      }`}
      style={{
        backgroundImage: `url("${acceptedIntelligenceArtPath(transmission)}")`,
      }}
    />
  );
}

export function hiddenIntelligenceArtPath(
  method?: FixedTransmissionMethod,
): string {
  if (method === "密电") return HIDDEN_SECRET_INTELLIGENCE_ART_PATH;
  if (method === "直达") return HIDDEN_DIRECT_INTELLIGENCE_ART_PATH;
  return HIDDEN_INTELLIGENCE_ART_PATH;
}

export function HiddenIntelligenceArtwork({
  method,
}: {
  method?: FixedTransmissionMethod;
}) {
  return (
    <span
      aria-hidden="true"
      className={`hidden-card__art${
        method === "密电"
          ? " hidden-card__art--secret"
          : method === "直达"
            ? " hidden-card__art--direct"
            : ""
      }`}
      style={{ backgroundImage: `url("${hiddenIntelligenceArtPath(method)}")` }}
    />
  );
}
