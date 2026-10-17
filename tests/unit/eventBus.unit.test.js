// TC-05, TC-13, TC-14: In-process event bus tests (ADR-006, FR-005)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus, EVENTS } from '../../src/events/eventBus.js';

test('eventBus: subscriber receives payload upon publish', async () => {
  const bus = createEventBus();
  const received = [];

  bus.on(EVENTS.STATUS_CHANGED, (payload) => {
    received.push(payload);
  });

  const payload = { requestId: 101, from: 'Submitted', to: 'Assigned', actorId: 5, rowVersion: 2 };
  bus.publish(EVENTS.STATUS_CHANGED, payload);

  // Allow promise tick to resolve
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], payload);
});

test('eventBus: subscriber error is isolated and does not disrupt subsequent subscribers (ADR-006)', async () => {
  const bus = createEventBus();
  const successfulCalls = [];

  // Faulty subscriber
  bus.on(EVENTS.STATUS_CHANGED, () => {
    throw new Error('Subscriber fatal crash');
  });

  // Healthy subscriber
  bus.on(EVENTS.STATUS_CHANGED, (payload) => {
    successfulCalls.push(payload.requestId);
  });

  // Should not throw to caller
  assert.doesNotThrow(() => {
    bus.publish(EVENTS.STATUS_CHANGED, { requestId: 202 });
  });

  await new Promise((resolve) => setImmediate(resolve));

  // The healthy subscriber still executed successfully
  assert.equal(successfulCalls.length, 1);
  assert.equal(successfulCalls[0], 202);
});
