import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PhysicalCard } from "../game/cards";
import type { PublicPlayerProjection } from "../game/engine";
import {
  ACCEPTED_INTELLIGENCE_ART_PATH,
  AcceptedIntelligenceArtwork,
  CARD_ART_PATHS,
  HIDDEN_DIRECT_INTELLIGENCE_ART_PATH,
  HIDDEN_INTELLIGENCE_ART_PATH,
  HIDDEN_SECRET_INTELLIGENCE_ART_PATH,
  HiddenIntelligenceArtwork,
  preloadCardArtwork,
} from "./CardArtwork";
import { DiscardPileDialog } from "./DiscardPile";
import { FinalHandsPanel } from "./FinalHandsPanel";

const lockCard = {
  id: "p1-05",
  photo: 1,
  position: 5,
  name: "锁定",
  color: "红",
  transmission: "密电",
  circle: false,
  unburnable: false,
} satisfies PhysicalCard;

describe("shared card artwork", () => {
  it("preloads every unique illustration used by the shared card views", () => {
    expect(CARD_ART_PATHS).toHaveLength(19);
    expect(new Set(CARD_ART_PATHS).size).toBe(CARD_ART_PATHS.length);
    expect(CARD_ART_PATHS).toContain("/card-art/public-text.webp");
    expect(CARD_ART_PATHS).toContain(HIDDEN_SECRET_INTELLIGENCE_ART_PATH);
  });

  it("starts and decodes every illustration before cards need it", async () => {
    const requested: string[] = [];
    const priorities: string[] = [];
    class FakeImage {
      decoding = "auto";
      fetchPriority = "auto";
      src = "";

      async decode() {
        requested.push(this.src);
        priorities.push(this.fetchPriority);
      }
    }
    vi.stubGlobal("Image", FakeImage);

    await preloadCardArtwork();

    expect(requested).toEqual(CARD_ART_PATHS);
    expect(priorities).toEqual(CARD_ART_PATHS.map(() => "high"));
    vi.unstubAllGlobals();
  });

  it("renders neutral artwork for 未公开情报 without visible text", () => {
    const markup = renderToStaticMarkup(<HiddenIntelligenceArtwork />);

    expect(markup).toContain(HIDDEN_INTELLIGENCE_ART_PATH);
    expect(markup).toContain("hidden-card__art");
    expect(markup).not.toContain("未公开情报");
  });

  it("uses distinct neutral artwork for concealed 密电 without leaking card metadata", () => {
    const markup = renderToStaticMarkup(
      <HiddenIntelligenceArtwork method="密电" />,
    );

    expect(markup).toContain(HIDDEN_SECRET_INTELLIGENCE_ART_PATH);
    expect(markup).toContain("hidden-card__art--secret");
    expect(markup).not.toContain("红");
    expect(markup).not.toContain("蓝");
  });

  it("uses hand-delivery artwork for concealed 直达", () => {
    const markup = renderToStaticMarkup(
      <HiddenIntelligenceArtwork method="直达" />,
    );

    expect(markup).toContain(HIDDEN_DIRECT_INTELLIGENCE_ART_PATH);
    expect(markup).toContain("hidden-card__art--direct");
    expect(markup).not.toContain(HIDDEN_SECRET_INTELLIGENCE_ART_PATH);
  });

  it("uses shared archived artwork for accepted intelligence", () => {
    const markup = renderToStaticMarkup(
      <AcceptedIntelligenceArtwork transmission="任意" />,
    );

    expect(markup).toContain(ACCEPTED_INTELLIGENCE_ART_PATH);
    expect(markup).toContain("game-card__art--accepted");
  });

  it.each([
    ["直达", HIDDEN_DIRECT_INTELLIGENCE_ART_PATH, "direct"],
    ["密电", HIDDEN_SECRET_INTELLIGENCE_ART_PATH, "secret"],
    ["文本", HIDDEN_INTELLIGENCE_ART_PATH, "text"],
    ["任意", ACCEPTED_INTELLIGENCE_ART_PATH, "flexible"],
  ] as const)(
    "maps accepted %s intelligence to its generic route artwork",
    (transmission, expectedPath, expectedClass) => {
      const markup = renderToStaticMarkup(
        <AcceptedIntelligenceArtwork transmission={transmission} />,
      );

      expect(markup).toContain(expectedPath);
      expect(markup).toContain(`game-card__art--accepted-${expectedClass}`);
    },
  );

  it("renders artwork in 弃牌堆", () => {
    const markup = renderToStaticMarkup(
      <DiscardPileDialog cards={[lockCard]} onClose={() => undefined} />,
    );

    expect(markup).toContain("/card-art/lock.webp");
    expect(markup).toContain("game-card__art");
  });

  it("renders artwork in 终局手牌公开", () => {
    const players = [{
      id: "甲",
      hand: [lockCard],
    }] as unknown as PublicPlayerProjection[];
    const markup = renderToStaticMarkup(
      <FinalHandsPanel playerDisplayNames={{ 甲: "小甲" }} players={players} />,
    );

    expect(markup).toContain("/card-art/lock.webp");
    expect(markup).toContain("final-hand-card game-card game-card--red");
  });
});
