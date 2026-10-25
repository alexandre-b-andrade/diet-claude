import type { CoachTool } from "./tools";
import { PROFILE_TOOLS } from "./tools";
import { DIARY_TOOLS } from "./diaryTools";

export const ONBOARDING_TOOLS: CoachTool[] = [...PROFILE_TOOLS];
export const COACH_TOOLS: CoachTool[] = [...PROFILE_TOOLS, ...DIARY_TOOLS];
