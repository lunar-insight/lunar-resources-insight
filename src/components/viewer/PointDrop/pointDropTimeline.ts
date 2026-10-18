// Stage times of the point drop, in milliseconds from "Create point".

export const PROBE_DURATION = 380;
export const IMPACT_START = PROBE_DURATION;
export const IMPACT_DURATION = 1100;
export const MARKER_START = 540;
export const MARKER_DURATION = 380;
export const FLY_START = MARKER_START + MARKER_DURATION;
export const FLY_DURATION = 700;
export const DROP_END = FLY_START + FLY_DURATION;

// With reduced motion every stage starts at once.
export const REDUCED_RING_DURATION = 900;
export const REDUCED_MARKER_DURATION = 300;
export const REDUCED_NOTICE_DURATION = 900;

// Arrival effects on Features, from the moment the dot lands.
export const ROW_HIGHLIGHT_DURATION = 1400;
export const RAIL_RECEIVE_DURATION = 900;

/** Rail id of the Features entry, the fly target while the Features window is closed. */
export const FEATURES_DIALOG_ID = 'features-dialog';
