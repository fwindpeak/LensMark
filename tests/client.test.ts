import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisClient } from '../src/core/analysisClient.ts';
import type { AnalysisResult } from '../src/types/evaluation.ts';

test('Worker requests isolate stale results, support cancellation and recover after worker failure', async () => {
  const keys = ['Worker', 'OffscreenCanvas', 'createImageBitmap'];
  const originals = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    messages: { id: number }[] = [];
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(message: { id: number }) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
  }
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: FakeWorker,
  });
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    configurable: true,
    value: class {},
  });
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    value: async () => ({ close() {} }),
  });
  const client = new AnalysisClient(),
    image = {} as HTMLImageElement;
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  try {
    const first = client.run(image, null, 'general', false, () => {});
    const firstRejected = assert.rejects(first, { name: 'AbortError' });
    await tick();
    const second = client.run(image, null, 'general', false, () => {});
    await firstRejected;
    await tick();
    const worker = workers[0],
      [old, active] = worker.messages;
    const expected = {
      selection: { x: 1, y: 2, w: 3, h: 4 },
    } as AnalysisResult;
    worker.onmessage?.({ data: { id: old.id, error: 'stale failure' } });
    worker.onmessage?.({ data: { id: active.id, result: expected } });
    assert.equal(await second, expected);
    const cancelled = client.run(image, null, 'general', false, () => {});
    const rejected = assert.rejects(cancelled, { name: 'AbortError' });
    await tick();
    client.dispose();
    await rejected;
    assert.equal(worker.terminated, true);
    const failed = client.run(image, null, 'general', false, () => {});
    const workerFailure = assert.rejects(failed, /后台分析加载失败/);
    await tick();
    workers.at(-1)!.onerror?.();
    await workerFailure;
    const recovered = client.run(image, null, 'general', false, () => {});
    await tick();
    const fresh = workers.at(-1)!;
    fresh.onmessage?.({ data: { id: fresh.messages[0].id, result: expected } });
    assert.equal(await recovered, expected);
  } finally {
    client.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
