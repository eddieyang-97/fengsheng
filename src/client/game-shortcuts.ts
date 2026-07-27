export const GAME_SHORTCUT_BINDINGS = {
  cardKeys: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  previousCard: "ArrowLeft",
  nextCard: "ArrowRight",
  confirm: "Enter",
  acceptIntelligence: "a",
  declineIntelligence: "d",
  passReaction: "s",
  passLock: "n",
  playLock: "l",
  playSwap: "r",
  playCounter: "c",
  playIntercept: "i",
  playBurn: "b",
  playLure: "u",
  playSeparation: "o",
  playDecrypt: "p",
  playReinforcement: "f",
  enterTransmissionPhase: "t",
  cancel: "Escape",
} as const;

export type GameShortcutIntent =
  | { type: "selectCard"; index: number }
  | { type: "moveCard"; direction: -1 | 1 }
  | { type: "confirm" }
  | { type: "acceptIntelligence" }
  | { type: "declineIntelligence" }
  | { type: "passReaction" }
  | { type: "passLock" }
  | { type: "playLock" }
  | { type: "playSwap" }
  | { type: "playCounter" }
  | { type: "playIntercept" }
  | { type: "playBurn" }
  | { type: "playLure" }
  | { type: "playSeparation" }
  | { type: "playDecrypt" }
  | { type: "playReinforcement" }
  | { type: "enterTransmissionPhase" }
  | { type: "cancel" };

export function gameShortcutIntent(key: string): GameShortcutIntent | undefined {
  const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
  const cardIndex = GAME_SHORTCUT_BINDINGS.cardKeys.indexOf(
    normalizedKey as (typeof GAME_SHORTCUT_BINDINGS.cardKeys)[number],
  );
  if (cardIndex >= 0) return { type: "selectCard", index: cardIndex };
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.previousCard) {
    return { type: "moveCard", direction: -1 };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.nextCard) {
    return { type: "moveCard", direction: 1 };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.confirm) return { type: "confirm" };
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.acceptIntelligence) {
    return { type: "acceptIntelligence" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.declineIntelligence) {
    return { type: "declineIntelligence" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.passReaction) {
    return { type: "passReaction" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.passLock) {
    return { type: "passLock" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playLock) {
    return { type: "playLock" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playSwap) {
    return { type: "playSwap" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playCounter) {
    return { type: "playCounter" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playIntercept) {
    return { type: "playIntercept" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playBurn) {
    return { type: "playBurn" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playLure) {
    return { type: "playLure" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playSeparation) {
    return { type: "playSeparation" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playDecrypt) {
    return { type: "playDecrypt" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.playReinforcement) {
    return { type: "playReinforcement" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.enterTransmissionPhase) {
    return { type: "enterTransmissionPhase" };
  }
  if (normalizedKey === GAME_SHORTCUT_BINDINGS.cancel) return { type: "cancel" };
  return undefined;
}

export function nextSelectableCardId(
  handIds: readonly string[],
  selectableCardIds: ReadonlySet<string>,
  selectedCardId: string | undefined,
  direction: -1 | 1,
): string | undefined {
  const selectableHandIds = handIds.filter((id) => selectableCardIds.has(id));
  if (selectableHandIds.length === 0) return undefined;
  const currentIndex = selectedCardId
    ? selectableHandIds.indexOf(selectedCardId)
    : -1;
  if (currentIndex < 0) {
    return direction === 1
      ? selectableHandIds[0]
      : selectableHandIds[selectableHandIds.length - 1];
  }
  return selectableHandIds[
    (currentIndex + direction + selectableHandIds.length) % selectableHandIds.length
  ];
}
