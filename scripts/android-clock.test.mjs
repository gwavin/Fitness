import test from 'node:test';
import assert from 'node:assert/strict';
import {clockBridgeLink, BRIDGE_PACKAGE} from '../plans/fitness-v2/android-clock.mjs';
const id = '12345678-1234-1234-1234-123456789abc', now = 1792321200000;
const fallback = 'https://gwavin.github.io/Fitness/plans/fitness-v2/android-clock.html';
test('explicit Google Clock bridge link contains only duration and opaque request metadata', () => {
  const link = clockBridgeLink(90,id,now,fallback);
  assert.ok(link.startsWith(`intent://timer?seconds=90&requestId=${id}&issuedAt=${now}#Intent;`));
  assert.ok(link.includes(`scheme=fitnessclock;package=${BRIDGE_PACKAGE};`));
  assert.ok(link.includes(`S.browser_fallback_url=${encodeURIComponent(fallback)};end`));
  assert.ok(!link.includes('workoutId'));
});
test('invalid or injectable duration, identity, timestamp and fallback are rejected', () => {
  for (const seconds of [0,14,3601,NaN,Infinity,1.5,'90;package=other']) assert.throws(() => clockBridgeLink(seconds,id,now,fallback));
  for (const request of ['',id+';action=other']) assert.throws(() => clockBridgeLink(90,request,now,fallback));
  assert.throws(() => clockBridgeLink(90,id,-1,fallback));
  assert.throws(() => clockBridgeLink(90,id,now,'javascript:alert(1)'));
});
