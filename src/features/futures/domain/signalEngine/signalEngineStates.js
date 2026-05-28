/**
 * Signal Engine — State constants
 *
 * Defines all valid states of the trading signal state machine and
 * helper sets for state-category queries.
 */

export const SIGNAL_STATES = Object.freeze({
  IDLE:                 'IDLE',
  OBSERVING:            'OBSERVING',
  LONG_BIAS:            'LONG_BIAS',
  SHORT_BIAS:           'SHORT_BIAS',
  LONG_SETUP:           'LONG_SETUP',
  SHORT_SETUP:          'SHORT_SETUP',
  LONG_ENTRY_SIGNAL:    'LONG_ENTRY_SIGNAL',
  SHORT_ENTRY_SIGNAL:   'SHORT_ENTRY_SIGNAL',
  LONG_POSITION_OPEN:   'LONG_POSITION_OPEN',
  SHORT_POSITION_OPEN:  'SHORT_POSITION_OPEN',
  LONG_EXIT_WARNING:    'LONG_EXIT_WARNING',
  SHORT_EXIT_WARNING:   'SHORT_EXIT_WARNING',
  LONG_EXIT_SIGNAL:     'LONG_EXIT_SIGNAL',
  SHORT_EXIT_SIGNAL:    'SHORT_EXIT_SIGNAL',
  COOLDOWN:             'COOLDOWN',
  INVALIDATED:          'INVALIDATED',
});

/** States in which the engine has an active local position. */
export const POSITION_ACTIVE_STATES = new Set([
  SIGNAL_STATES.LONG_POSITION_OPEN,
  SIGNAL_STATES.SHORT_POSITION_OPEN,
  SIGNAL_STATES.LONG_EXIT_WARNING,
  SIGNAL_STATES.SHORT_EXIT_WARNING,
  SIGNAL_STATES.LONG_EXIT_SIGNAL,
  SIGNAL_STATES.SHORT_EXIT_SIGNAL,
]);

/** States that represent entry signals. */
export const ENTRY_SIGNAL_STATES = new Set([
  SIGNAL_STATES.LONG_ENTRY_SIGNAL,
  SIGNAL_STATES.SHORT_ENTRY_SIGNAL,
]);

/** States that represent exit signals. */
export const EXIT_SIGNAL_STATES = new Set([
  SIGNAL_STATES.LONG_EXIT_SIGNAL,
  SIGNAL_STATES.SHORT_EXIT_SIGNAL,
]);

/** States that represent exit warnings. */
export const EXIT_WARNING_STATES = new Set([
  SIGNAL_STATES.LONG_EXIT_WARNING,
  SIGNAL_STATES.SHORT_EXIT_WARNING,
]);

/** States with a long directional bias (engine is watching longs). */
export const LONG_STATES = new Set([
  SIGNAL_STATES.LONG_BIAS,
  SIGNAL_STATES.LONG_SETUP,
  SIGNAL_STATES.LONG_ENTRY_SIGNAL,
  SIGNAL_STATES.LONG_POSITION_OPEN,
  SIGNAL_STATES.LONG_EXIT_WARNING,
  SIGNAL_STATES.LONG_EXIT_SIGNAL,
]);

/** States with a short directional bias (engine is watching shorts). */
export const SHORT_STATES = new Set([
  SIGNAL_STATES.SHORT_BIAS,
  SIGNAL_STATES.SHORT_SETUP,
  SIGNAL_STATES.SHORT_ENTRY_SIGNAL,
  SIGNAL_STATES.SHORT_POSITION_OPEN,
  SIGNAL_STATES.SHORT_EXIT_WARNING,
  SIGNAL_STATES.SHORT_EXIT_SIGNAL,
]);

/** Cooldown duration in ms after a signal is accepted, rejected, or invalidated. */
export const COOLDOWN_DURATION_MS = 60_000;

/** Signal expiration time in ms after a LONG/SHORT_ENTRY_SIGNAL is emitted. */
export const ENTRY_SIGNAL_EXPIRY_MS = 30_000;

/** Signal expiration time in ms after a LONG/SHORT_EXIT_SIGNAL is emitted. */
export const EXIT_SIGNAL_EXPIRY_MS = 45_000;
