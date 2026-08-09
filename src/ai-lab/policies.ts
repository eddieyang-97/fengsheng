import { TACTICAL_V2, TACTICAL_V3, TACTICAL_V4, TACTICAL_V5, TACTICAL_V6, TACTICAL_V7, TACTICAL_V8, TACTICAL_V9, TACTICAL_V10, TACTICAL_V11, TACTICAL_V12, TACTICAL_V13, TACTICAL_V14, type BotPolicy } from "../server/bot/strategy";

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

export const CANDIDATE_V21: BotPolicy = {
  ...TACTICAL_V9,
  id: "candidate-v21",
  lethalLockEvidence: 1.2,
};

export const CANDIDATE_V22: BotPolicy = {
  ...TACTICAL_V8,
  id: "candidate-v22",
  dangerousDiscardStrategy: "target-value",
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

export const CANDIDATE_V37: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v37",
  factionThreatTargeting: "all",
};

export const CANDIDATE_V38: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v38",
  factionThreatTargeting: "dangerous",
};

export const CANDIDATE_V39: BotPolicy = {
  ...TACTICAL_V11,
  id: "candidate-v39",
  factionThreatTargeting: "probe",
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
  CANDIDATE_V14,
  CANDIDATE_V15,
  CANDIDATE_V16,
  CANDIDATE_V17,
  CANDIDATE_V19,
  CANDIDATE_V20,
  CANDIDATE_V21,
  CANDIDATE_V22,
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
];

export function evaluationPolicyById(id: string): BotPolicy {
  const policy = EVALUATION_POLICIES.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(`unknown policy '${id}'; choose one of: ${EVALUATION_POLICIES.map((item) => item.id).join(", ")}`);
  }
  return policy;
}
