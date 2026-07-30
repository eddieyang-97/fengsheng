import { TACTICAL_V2, TACTICAL_V3, TACTICAL_V4, TACTICAL_V5, TACTICAL_V6, TACTICAL_V7, type BotPolicy } from "../server/bot/strategy";

export const CANDIDATE_V3: BotPolicy = {
  id: "candidate-v3",
  beliefModel: "exact",
  scoring: "tactical",
  burnBase: 7,
  reactionConservation: 0,
  incrementalTransfer: false,
  incrementalLure: false,
  lureRequiresLikelyAcceptance: false,
  lockRequiresLikelyDecline: false,
  methodAwareDangerousTransmission: false,
  conservativeSwap: false,
  routeAwareTransmission: false,
  routeAwareTransmissionCardChoice: false,
  routeAwareTransmissionMethodChoice: false,
  targetedFunctionConservation: false,
  inferResolvedActionAffinity: false,
};

export const CANDIDATE_V4: BotPolicy = {
  ...CANDIDATE_V3,
  id: "candidate-v4",
  burnBase: 4,
};

export const CANDIDATE_V5: BotPolicy = {
  ...TACTICAL_V3,
  id: "candidate-v5",
};

export const CANDIDATE_V6: BotPolicy = {
  ...CANDIDATE_V5,
  id: "candidate-v6",
  reactionConservation: 0.75,
};

export const CANDIDATE_V7: BotPolicy = {
  ...CANDIDATE_V5,
  id: "candidate-v7",
  incrementalTransfer: true,
};

export const CANDIDATE_V8: BotPolicy = {
  ...CANDIDATE_V5,
  id: "candidate-v8",
  incrementalLure: true,
};

export const CANDIDATE_V9: BotPolicy = {
  ...TACTICAL_V4,
  id: "candidate-v9",
  incrementalTransfer: true,
};

export const CANDIDATE_V10: BotPolicy = {
  ...TACTICAL_V5,
  id: "candidate-v10",
  incrementalTransfer: true,
};

export const CANDIDATE_V11: BotPolicy = {
  ...TACTICAL_V5,
  id: "candidate-v11",
  inferResolvedActionAffinity: true,
};

export const CANDIDATE_V12: BotPolicy = {
  ...TACTICAL_V5,
  id: "candidate-v12",
  methodAwareDangerousTransmission: true,
};

export const CANDIDATE_V13: BotPolicy = {
  ...TACTICAL_V5,
  id: "candidate-v13",
  conservativeSwap: true,
};

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

export const EVALUATION_POLICIES: readonly BotPolicy[] = [
  TACTICAL_V2,
  TACTICAL_V3,
  TACTICAL_V4,
  TACTICAL_V5,
  TACTICAL_V6,
  TACTICAL_V7,
  CANDIDATE_V3,
  CANDIDATE_V4,
  CANDIDATE_V5,
  CANDIDATE_V6,
  CANDIDATE_V7,
  CANDIDATE_V8,
  CANDIDATE_V9,
  CANDIDATE_V10,
  CANDIDATE_V11,
  CANDIDATE_V12,
  CANDIDATE_V13,
  CANDIDATE_V14,
  CANDIDATE_V15,
  CANDIDATE_V16,
];

export function evaluationPolicyById(id: string): BotPolicy {
  const policy = EVALUATION_POLICIES.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(`unknown policy '${id}'; choose one of: ${EVALUATION_POLICIES.map((item) => item.id).join(", ")}`);
  }
  return policy;
}
