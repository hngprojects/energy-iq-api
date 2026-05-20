// ==================================================================
// METRICS PUBSUB SERVICE — Pattern Subscriptions
// Tests for MetricsPubSubService in pubsub/metrics-pubsub.service.ts
//
// Strategy: instantiate the service directly, skip onModuleInit
// (which creates real Redis clients), and inject a mock subscriber
// onto the private field. All tests exercise psubscribe/punsubscribe
// and the pmessage routing logic without touching Redis.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { MetricsPubSubService } from '../pubsub/metrics-pubsub.service';
import { ConfigService } from '@nestjs/config';

// ------------------------------------------------------------------
// Mock subscriber — mirrors the ioredis client surface used by the service
// ------------------------------------------------------------------
function makeMockSubscriber() {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};

  return {
    psubscribe: jest.fn().mockResolvedValue(undefined),
    punsubscribe: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest
      .fn()
      .mockImplementation((event: string, cb: (...args: any[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
    // Helper: emit a pmessage event as ioredis would
    emitPmessage(pattern: string, channel: string, message: string) {
      (listeners['pmessage'] ?? []).forEach((cb) =>
        cb(pattern, channel, message),
      );
    },
  };
}

// ------------------------------------------------------------------
// Factory: build a MetricsPubSubService with mocked internals
// ------------------------------------------------------------------
function makeService() {
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  const service = new MetricsPubSubService(configService);

  // Inject mock subscriber directly — bypasses onModuleInit / real Redis
  const mockSubscriber = makeMockSubscriber();
  (service as unknown as { subscriber: typeof mockSubscriber }).subscriber =
    mockSubscriber;

  // Wire up the pmessage listener the same way onModuleInit does
  mockSubscriber.on(
    'pmessage',
    (pattern: string, channel: string, message: string) => {
      const svc = service as unknown as {
        patternSubscriptions: Map<
          string,
          Set<(msg: string, ch: string) => void>
        >;
      };
      const callbacks = svc.patternSubscriptions.get(pattern);
      if (callbacks) {
        callbacks.forEach((cb) => cb(message, channel));
      }
    },
  );

  return { service, mockSubscriber };
}

// ------------------------------------------------------------------
// Section 9: MetricsPubSubService — Test Cases
// ------------------------------------------------------------------
describe('MetricsPubSubService — Test Cases', () => {
  // ------------------------------------------------------------------
  // 9.1  psubscribe calls subscriber.psubscribe on first call
  // ------------------------------------------------------------------
  it('9.1 should call subscriber.psubscribe when subscribing to a pattern for the first time', async () => {
    const { service, mockSubscriber } = makeService();
    const cb = jest.fn();

    await service.psubscribe('inverter:*', cb);

    expect(mockSubscriber.psubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscriber.psubscribe).toHaveBeenCalledWith('inverter:*');
  });

  // ------------------------------------------------------------------
  // 9.2  psubscribe does not double-subscribe for the same pattern
  // ------------------------------------------------------------------
  it('9.2 should not call subscriber.psubscribe a second time for the same pattern', async () => {
    const { service, mockSubscriber } = makeService();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    await service.psubscribe('inverter:*', cb1);
    await service.psubscribe('inverter:*', cb2);

    expect(mockSubscriber.psubscribe).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // 9.3  psubscribe registers callback — invoked on pmessage
  // ------------------------------------------------------------------
  it('9.3 should invoke the registered callback when a pmessage arrives on the subscribed pattern', async () => {
    const { service, mockSubscriber } = makeService();
    const cb = jest.fn();

    await service.psubscribe('inverter:*', cb);
    mockSubscriber.emitPmessage('inverter:*', 'inverter:abc', '{"soc":80}');

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('{"soc":80}', 'inverter:abc');
  });

  // ------------------------------------------------------------------
  // 9.4  Multiple callbacks for the same pattern — all invoked
  // ------------------------------------------------------------------
  it('9.4 should invoke all registered callbacks when multiple subscribers share the same pattern', async () => {
    const { service, mockSubscriber } = makeService();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    await service.psubscribe('inverter:*', cb1);
    await service.psubscribe('inverter:*', cb2);
    mockSubscriber.emitPmessage('inverter:*', 'inverter:xyz', 'payload');

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // 9.5  punsubscribe removes callback — no longer invoked
  // ------------------------------------------------------------------
  it('9.5 should not invoke a callback after it has been unsubscribed', async () => {
    const { service, mockSubscriber } = makeService();
    const cb = jest.fn();

    await service.psubscribe('inverter:*', cb);
    await service.punsubscribe('inverter:*', cb);
    mockSubscriber.emitPmessage('inverter:*', 'inverter:abc', 'payload');

    expect(cb).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 9.6  punsubscribe calls subscriber.punsubscribe when last callback removed
  // ------------------------------------------------------------------
  it('9.6 should call subscriber.punsubscribe when the last callback for a pattern is removed', async () => {
    const { service, mockSubscriber } = makeService();
    const cb = jest.fn();

    await service.psubscribe('inverter:*', cb);
    await service.punsubscribe('inverter:*', cb);

    expect(mockSubscriber.punsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscriber.punsubscribe).toHaveBeenCalledWith('inverter:*');
  });

  // ------------------------------------------------------------------
  // 9.7  punsubscribe does NOT call subscriber.punsubscribe when other callbacks remain
  // ------------------------------------------------------------------
  it('9.7 should not call subscriber.punsubscribe when other callbacks are still registered for the pattern', async () => {
    const { service, mockSubscriber } = makeService();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    await service.psubscribe('inverter:*', cb1);
    await service.psubscribe('inverter:*', cb2);
    await service.punsubscribe('inverter:*', cb1); // cb2 still registered

    expect(mockSubscriber.punsubscribe).not.toHaveBeenCalled();
    // cb2 should still fire
    mockSubscriber.emitPmessage('inverter:*', 'inverter:abc', 'payload');
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 9.8  pmessage routes to correct pattern only
  // ------------------------------------------------------------------
  it('9.8 should only invoke callbacks for the matching pattern, not for other subscribed patterns', async () => {
    const { service, mockSubscriber } = makeService();
    const inverterCb = jest.fn();
    const solarCb = jest.fn();

    await service.psubscribe('inverter:*', inverterCb);
    await service.psubscribe('solar:*', solarCb);

    // Emit on inverter:* pattern only
    mockSubscriber.emitPmessage('inverter:*', 'inverter:001', 'inverter-data');

    expect(inverterCb).toHaveBeenCalledTimes(1);
    expect(inverterCb).toHaveBeenCalledWith('inverter-data', 'inverter:001');
    expect(solarCb).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// Section 9: MetricsPubSubService — Edge Cases
// ------------------------------------------------------------------
describe('MetricsPubSubService — Edge Cases', () => {
  // ------------------------------------------------------------------
  // Extra: punsubscribe on unknown pattern does not throw
  // ------------------------------------------------------------------
  it('should not throw when punsubscribe is called for a pattern that was never subscribed', async () => {
    const { service } = makeService();
    const cb = jest.fn();

    await expect(
      service.punsubscribe('never-subscribed:*', cb),
    ).resolves.not.toThrow();
  });

  // ------------------------------------------------------------------
  // Extra: same callback registered twice — deduplicated (Set semantics)
  // ------------------------------------------------------------------
  it('should deduplicate identical callback references registered for the same pattern', async () => {
    const { service, mockSubscriber } = makeService();
    const cb = jest.fn();

    await service.psubscribe('inverter:*', cb);
    await service.psubscribe('inverter:*', cb); // same reference

    mockSubscriber.emitPmessage('inverter:*', 'inverter:abc', 'payload');

    // Set deduplication means cb fires exactly once, not twice
    expect(cb).toHaveBeenCalledTimes(1);
    // And subscriber.psubscribe was only called once
    expect(mockSubscriber.psubscribe).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Extra: message and channel are passed through correctly
  // ------------------------------------------------------------------
  it('should pass the exact message string and channel name to the callback', async () => {
    const { service, mockSubscriber } = makeService();
    const cb = jest.fn();

    await service.psubscribe('inverter:*', cb);
    mockSubscriber.emitPmessage(
      'inverter:*',
      'inverter:unit-42',
      '{"batterySoc":55,"acOutputPowerKw":3.2}',
    );

    expect(cb).toHaveBeenCalledWith(
      '{"batterySoc":55,"acOutputPowerKw":3.2}',
      'inverter:unit-42',
    );
  });

  // ------------------------------------------------------------------
  // Extra: two patterns, both receive their own messages independently
  // ------------------------------------------------------------------
  it('should route messages to both patterns independently when both are subscribed', async () => {
    const { service, mockSubscriber } = makeService();
    const inverterCb = jest.fn();
    const solarCb = jest.fn();

    await service.psubscribe('inverter:*', inverterCb);
    await service.psubscribe('solar:*', solarCb);

    mockSubscriber.emitPmessage('inverter:*', 'inverter:001', 'inv-msg');
    mockSubscriber.emitPmessage('solar:*', 'solar:002', 'solar-msg');

    expect(inverterCb).toHaveBeenCalledWith('inv-msg', 'inverter:001');
    expect(solarCb).toHaveBeenCalledWith('solar-msg', 'solar:002');
  });

  // ------------------------------------------------------------------
  // Extra: after full unsubscribe, re-subscribing works correctly
  // ------------------------------------------------------------------
  it('should allow re-subscribing to a pattern after all callbacks have been removed', async () => {
    const { service, mockSubscriber } = makeService();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    await service.psubscribe('inverter:*', cb1);
    await service.punsubscribe('inverter:*', cb1); // fully removed

    await service.psubscribe('inverter:*', cb2); // re-subscribe
    mockSubscriber.emitPmessage('inverter:*', 'inverter:abc', 'payload');

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).not.toHaveBeenCalled();
    // subscriber.psubscribe called twice: once on first subscribe, once on re-subscribe
    expect(mockSubscriber.psubscribe).toHaveBeenCalledTimes(2);
  });
});
