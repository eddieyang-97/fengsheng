import { TACTICAL_V2, TACTICAL_V3, TACTICAL_V4, TACTICAL_V5, TACTICAL_V6, TACTICAL_V7, TACTICAL_V8, TACTICAL_V9, type BotPolicy } from "../server/bot/strategy";

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

export const EVALUATION_POLICIES: readonly BotPolicy[] = [
  TACTICAL_V2,
  TACTICAL_V3,
  TACTICAL_V4,
  TACTICAL_V5,
  TACTICAL_V6,
  TACTICAL_V7,
  TACTICAL_V8,
  TACTICAL_V9,
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
];

export function evaluationPolicyById(id: string): BotPolicy {
  const policy = EVALUATION_POLICIES.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(`unknown policy '${id}'; choose one of: ${EVALUATION_POLICIES.map((item) => item.id).join(", ")}`);
  }
  return policy;
}
