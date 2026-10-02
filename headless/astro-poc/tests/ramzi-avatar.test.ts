import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consoleMood, motionIsOff, type MotionSnapshot } from '../src/components/ramzi/ramzi-mood.ts';

function snap(partial: Partial<MotionSnapshot> & { storage?: Record<string, string> }): MotionSnapshot {
  const bag = partial.storage || {};
  const classes = new Set(partial.classList ? [] : []);
  return {
    hidden: partial.hidden ?? false,
    reduced: partial.reduced ?? false,
    eventOff: partial.eventOff ?? false,
    classList: partial.classList || { contains: (name: string) => classes.has(name) },
    storage: {
      getItem: (key: string) => (key in bag ? bag[key] : null),
    },
  };
}

describe('Ramzi motion and mood', () => {
  it('stays on when every switch is clear', () => {
    assert.equal(motionIsOff(snap({})), false);
  });

  it('turns off for each of the four site triggers', () => {
    assert.equal(motionIsOff(snap({ reduced: true })), true);
    assert.equal(motionIsOff(snap({ eventOff: true })), true);
    assert.equal(
      motionIsOff(snap({ classList: { contains: (name) => name === 'nd-motion-off' } })),
      true
    );
    assert.equal(
      motionIsOff(snap({ classList: { contains: (name) => name === 'noam-a11y-motion' } })),
      true
    );
    assert.equal(motionIsOff(snap({ storage: { 'noam-a11y-motion': 'off' } })), true);
    assert.equal(
      motionIsOff(snap({ storage: { 'noam-accessibility-v1': JSON.stringify({ stopAnim: true }) } })),
      true
    );
  });

  it('maps console state onto the five moods without demo text', () => {
    assert.equal(consoleMood({ thinking: false, error: false, hintDelivered: false, confirmed: false }), 'idle');
    assert.equal(consoleMood({ thinking: true, error: true, hintDelivered: true, confirmed: true }), 'thinking');
    assert.equal(consoleMood({ thinking: false, error: true, hintDelivered: true, confirmed: true }), 'error');
    assert.equal(consoleMood({ thinking: false, error: false, hintDelivered: true, confirmed: true }), 'success');
    assert.equal(consoleMood({ thinking: false, error: false, hintDelivered: true, confirmed: false }), 'hint');
  });
});
