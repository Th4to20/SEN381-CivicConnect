// In-process event dispatch (Assignment 2 Task 3). No network boundary.
// Consumers are published to ONLY AFTER the transaction commits (ADR-001).
import { EventEmitter } from 'node:events';

export const EVENTS = Object.freeze({ STATUS_CHANGED: 'request.status_changed' });

export function createEventBus() {
  const emitter = new EventEmitter();
  return {
    on: (name, handler) => emitter.on(name, handler),
    /** A failing subscriber must never affect the committed operation or other subscribers. */
    publish(name, payload) {
      for (const handler of emitter.listeners(name)) {
        Promise.resolve()
          .then(() => handler(payload))
          .catch((err) => console.error(`[event:${name}] subscriber failed:`, err.message));
      }
    },
  };
}
