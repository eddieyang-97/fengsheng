import { TACTICAL_V2, TACTICAL_V3, TACTICAL_V4, TACTICAL_V5, TACTICAL_V6, TACTICAL_V7, TACTICAL_V8, TACTICAL_V9, TACTICAL_V10, TACTICAL_V11, TACTICAL_V12, TACTICAL_V13, TACTICAL_V14, TACTICAL_V15, TACTICAL_V16, TACTICAL_V17, TACTICAL_V18, TACTICAL_V19, TACTICAL_V20, TACTICAL_V21, TACTICAL_V22, TACTICAL_V23, TACTICAL_V24, TACTICAL_V25, TACTICAL_V26, TACTICAL_V27, type BotPolicy } from "../server/bot/strategy";

export const CANDIDATE_V14: BotPolicy = {
  ...TACTICAL_V6,
  id: "candidate-v14",
  routeAwareTransmission: true,
  routeAwareTransmissionCardChoice: true,
  routeAwareTransmissionMethodChoice: true,
};

export const CANDIDATE_V15: BotPolicy = {
  ...TACTICAL_V6,
  id: "candidate-v15",
  routeAwareTransmission: true,
  routeAwareTransmissionCardChoice: false,
  routeAwareTransmissionMethodChoice: true,
};

export const CANDIDATE_V16: BotPolicy = {
  ...TACTICAL_V6,
  id: "candidate-v16",
  routeAwareTransmission: true,
  routeAwareTransmissionCardChoice: false,
  routeAwareTransmissionMethodChoice: false,
};

export const CANDIDATE_V17: BotPolicy = {
  ...TACTICAL_V7,
  id: "candidate-v17",
  declineRouting: "acceptance-weighted",
};

export const CANDIDATE_V19: BotPolicy = {
  ...TACTICAL_V8,
  id: "candidate-v19",
  directTransmissionEvidence: "all",
};

export const CANDIDATE_V20: BotPolicy = {
  ...TACTICAL_V8,
  id: "candidate-v20",
  directTransmissionEvidence: "black-only",
};

export const CANDIDATE_V23: BotPolicy = {
  ...TACTICAL_V8,
  id: "candidate-v23",
  dangerousDiscardStrategy: "color-denial",
};

export const CANDIDATE_V24: BotPolicy = {
  ...TACTICAL_V8,
  id: "candidate-v24",
  dangerousDiscardStrategy: "color-then-function",
};

export const CANDIDATE_V25: BotPolicy = {
  ...TACTICAL_V10,
  id: "candidate-v25",
  directTransmissionEvidence: "black-only",
};

export const CANDIDATE_V26: BotPolicy = {
  ...CANDIDATE_V25,
  id: "candidate-v26",
  directTransmissionEvidenceStrength: 0.5,
};

export const CANDIDATE_V27: BotPolicy = {
  ...TACTICAL_V10,
  id: "candidate-v27",
  lethalLockEvidence: 1.2,
};

export const CANDIDATE_V28: BotPolicy = {
  ...TACTICAL_V10,
  id: "candidate-v28",
  declineRouting: "acceptance-weighted",
};

export const CANDIDATE_V29: BotPolicy = {
  ...TACTICAL_V10,
  id: "candidate-v29",
  dangerousDiscardStrategy: "expected-denial",
};

export const CANDIDATE_V30: BotPolicy = {
  ...TACTICAL_V10,
  id: "candidate-v30",
  finalReceiptSwapScoring: true,
};

export const CANDIDATE_V31: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v31",
  publicTextExchangeScoring: true,
};

export const CANDIDATE_V32: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v32",
  probeCounterAffinityScoring: true,
};

export const CANDIDATE_V33: BotPolicy = {
  ...CANDIDATE_V32,
  id: "candidate-v33",
  probeIdentityChoiceScoring: true,
};

export const CANDIDATE_V34: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v34",
  incrementalInterceptScoring: true,
};

export const CANDIDATE_V35: BotPolicy = {
  ...CANDIDATE_V34,
  id: "candidate-v35",
  interceptOpportunityCostFactor: 0.6,
};

export const CANDIDATE_V36: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v36",
  transferAgainstBestFreeAlternative: true,
};

export const CANDIDATE_V40: BotPolicy = {
  ...TACTICAL_V14,
  id: "candidate-v40",
  dangerousDiscardChoiceEvidence: 0.8,
};

export const CANDIDATE_V43: BotPolicy = {
  ...TACTICAL_V19,
  id: "candidate-v43",
  probeCounterAffinityScoring: true,
  incomingProbeAffinityWeight: 0,
};

export const CANDIDATE_V44: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v44",
  incomingProbeAffinityWeight: 4,
};

export const CANDIDATE_V45: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v45",
  incomingProbeAffinityWeight: 8,
};

export const CANDIDATE_V46: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v46",
  incomingProbeAffinityWeight: 12,
};

export const CANDIDATE_V47: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v47",
  incomingProbeCounterCost: 4,
};

export const CANDIDATE_V48: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v48",
  incomingProbeCounterCost: 8,
};

export const CANDIDATE_V49: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v49",
  incomingProbeCounterCost: 12,
};

export const CANDIDATE_V50: BotPolicy = {
  ...CANDIDATE_V43,
  id: "candidate-v50",
  incomingProbeCounterCost: 16,
};

export const CANDIDATE_V51: BotPolicy = {
  ...TACTICAL_V20,
  id: "candidate-v51",
  knownHandDangerousTargetWeight: 0.5,
};

export const CANDIDATE_V53: BotPolicy = {
  ...TACTICAL_V20,
  id: "candidate-v53",
  resolvedProbeAffinityScale: 1,
};

export const CANDIDATE_V57: BotPolicy = {
  ...TACTICAL_V20,
  id: "candidate-v57",
  committedTransferInterceptScoring: true,
  interceptOpportunityCostFactor: 0.6,
};

export const CANDIDATE_V58: BotPolicy = {
  ...TACTICAL_V20,
  id: "candidate-v58",
  avoidOwnTransferInterceptUndo: true,
};

export const CANDIDATE_V59: BotPolicy = {
  ...TACTICAL_V22,
  id: "candidate-v59",
  knownHandSecretOrderWeight: 0.25,
};

export const CANDIDATE_V69: BotPolicy = {
  ...TACTICAL_V23,
  id: "candidate-v69",
  transferOpportunityCost: 1,
};

export const CANDIDATE_V70: BotPolicy = {
  ...TACTICAL_V25,
  id: "candidate-v70",
};

export const EVALUATION_POLICIES: readonly BotPolicy[] = [
  TACTICAL_V2,
  TACTICAL_V3,
  TACTICAL_V4,
  TACTICAL_V5,
  TACTICAL_V6,
  TACTICAL_V7,
  TACTICAL_V8,
  TACTICAL_V9,
  TACTICAL_V10,
  TACTICAL_V11,
  TACTICAL_V12,
  TACTICAL_V13,
  TACTICAL_V14,
  TACTICAL_V15,
  TACTICAL_V16,
  TACTICAL_V17,
  TACTICAL_V18,
  TACTICAL_V19,
  TACTICAL_V20,
  TACTICAL_V21,
  TACTICAL_V22,
  TACTICAL_V23,
  TACTICAL_V24,
  TACTICAL_V25,
  TACTICAL_V26,
  TACTICAL_V27,
  CANDIDATE_V14,
  CANDIDATE_V15,
  CANDIDATE_V16,
  CANDIDATE_V17,
  CANDIDATE_V19,
  CANDIDATE_V20,
  CANDIDATE_V23,
  CANDIDATE_V24,
  CANDIDATE_V25,
  CANDIDATE_V26,
  CANDIDATE_V27,
  CANDIDATE_V28,
  CANDIDATE_V29,
  CANDIDATE_V30,
  CANDIDATE_V31,
  CANDIDATE_V32,
  CANDIDATE_V33,
  CANDIDATE_V40,
  CANDIDATE_V43,
  CANDIDATE_V44,
  CANDIDATE_V45,
  CANDIDATE_V46,
  CANDIDATE_V47,
  CANDIDATE_V48,
  CANDIDATE_V49,
  CANDIDATE_V50,
  CANDIDATE_V51,
  CANDIDATE_V53,
  CANDIDATE_V57,
  CANDIDATE_V58,
  CANDIDATE_V59,
  CANDIDATE_V69,
  CANDIDATE_V70,
];

export function evaluationPolicyById(id: string): BotPolicy {
  const policy = EVALUATION_POLICIES.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(`unknown policy '${id}'; choose one of: ${EVALUATION_POLICIES.map((item) => item.id).join(", ")}`);
  }
  return policy;
}
