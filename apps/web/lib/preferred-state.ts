import { getStateByCode } from "@/lib/states";

export const PREFERRED_STATE_COOKIE_NAME = "csn_preferred_state";
export const PREFERRED_STATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function normalizePreferredState(value?: string | null) {
  return getStateByCode(value)?.code ?? null;
}
