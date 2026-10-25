import type { CoachTool } from "./tools";
import { PROFILE_TOOLS } from "./tools";
import { DIARY_TOOLS } from "./diaryTools";
import { BODY_TOOLS } from "./bodyTools";

export const ONBOARDING_TOOLS: CoachTool[] = [...PROFILE_TOOLS, registrarBioOnly()];
export const COACH_TOOLS: CoachTool[] = [...PROFILE_TOOLS, ...DIARY_TOOLS, ...BODY_TOOLS];

function registrarBioOnly(): CoachTool {
  return BODY_TOOLS.find((t) => t.name === "registrar_bioimpedancia")!;
}
