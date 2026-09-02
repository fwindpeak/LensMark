import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { demoPixels, targetSvg } from '../src/core/demoImages.ts';
import { RECORDS_KEY } from '../src/core/evaluationRecords.ts';

/** DOM workflow tests with real Canvas pixel decoding; not a replacement for layout/device QA. */
test(
  'Upload → photo verdict → lens tests → comparison → parameter edit → export/restore',
  { timeout: 60000 },
  async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: 'https://lensmark.test/',
    });
    const win = dom.window;
    const globals = [
      'window',
      'document',
      'navigator',
      'HTMLElement',
      'HTMLCanvasElement',
      'HTMLDialogElement',
      'localStorage',
      'IS_REACT_ACT_ENVIRONMENT',
      'Image',
      'ResizeObserver',
      'FileReader',
    ];
    const descriptors = new Map(
      globals.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
    );
    const set = (k: string, value: unknown) =>
      Object.defineProperty(globalThis, k, {
        configurable: true,
        writable: true,
        value,
      });
    for (const k of [
      'window',
      'document',
      'navigator',
      'HTMLElement',
      'HTMLCanvasElement',
      'HTMLDialogElement',
      'localStorage',
    ])
      set(k, k === 'window' ? win : (win as any)[k]);
    set('IS_REACT_ACT_ENVIRONMENT', true);
    set(
      'FileReader',
      class {
        result: ArrayBuffer | null = null;
        onloadend?: () => void;
        onerror?: (error: unknown) => void;
        readAsArrayBuffer(blob: Blob) {
          blob.arrayBuffer().then(
            (result) => {
              this.result = result;
              this.onloadend?.();
            },
            (error) => this.onerror?.(error),
          );
        }
      },
    );
    Object.defineProperty(win.HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(win.HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 260,
    });
    set(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    win.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    win.HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    const bitmaps = new WeakMap<object, ReturnType<typeof createCanvas>>();
    const nativeCanvas = (canvas: HTMLCanvasElement) => {
      let native = bitmaps.get(canvas);
      if (!native) {
        native = createCanvas(
          Math.max(1, canvas.width),
          Math.max(1, canvas.height),
        );
        bitmaps.set(canvas, native);
      }
      return native;
    };
    for (const prop of ['width', 'height'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(
        win.HTMLCanvasElement.prototype,
        prop,
      )!;
      Object.defineProperty(win.HTMLCanvasElement.prototype, prop, {
        ...descriptor,
        set(value) {
          descriptor.set!.call(this, value);
          const c = bitmaps.get(this);
          if (c) c[prop] = Math.max(1, Number(value));
        },
      });
    }
    win.HTMLCanvasElement.prototype.getContext = function () {
      const ctx = nativeCanvas(this as unknown as HTMLCanvasElement).getContext(
        '2d',
      );
      return new Proxy(ctx, {
        get(target, key) {
          if (key === 'drawImage')
            return (image: any, ...args: number[]) =>
              (target.drawImage as any)(
                image.native ??
                  (image instanceof win.HTMLCanvasElement
                    ? nativeCanvas(image)
                    : image),
                ...args,
              );
          const value = (target as any)[key];
          return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, key, value) {
          (target as any)[key] = value;
          return true;
        },
      }) as any;
    };
    win.HTMLCanvasElement.prototype.toDataURL = function (
      type?: string,
      quality?: number,
    ) {
      return nativeCanvas(this as unknown as HTMLCanvasElement).toDataURL(
        type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
        quality,
      );
    };
    const blobs = new Map<string, Blob>(),
      downloads: { name: string; blob?: Blob }[] = [];
    const createUrl = URL.createObjectURL,
      revokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => {
      const url = 'blob:test/' + blobs.size;
      blobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = () => {};
    win.HTMLAnchorElement.prototype.click = function () {
      downloads.push({ name: this.download, blob: blobs.get(this.href) });
    };
    set(
      'Image',
      class {
        native: Awaited<ReturnType<typeof loadImage>> | null = null;
        promise: Promise<void> = Promise.resolve();
        onload?: () => void;
        onerror?: (error: unknown) => void;
        get naturalWidth() {
          return this.native?.width ?? 0;
        }
        get naturalHeight() {
          return this.native?.height ?? 0;
        }
        set src(value: string) {
          this.promise = (async () => {
            const blob = blobs.get(value);
            this.native = await loadImage(
              blob ? Buffer.from(await blob.arrayBuffer()) : value,
            );
          })();
          this.promise.then(
            () => this.onload?.(),
            (error) => this.onerror?.(error),
          );
        }
        decode() {
          return this.promise;
        }
      },
    );
    const require = createRequire(import.meta.url),
      temp = await mkdtemp(join(tmpdir(), 'lensmark-ui-'));
    const output = join(temp, 'app.mjs');
    let root: import('react-dom/client').Root | null = null;
    const { act, createElement } = await import('react');
    try {
      await build({
        entryPoints: [join(process.cwd(), 'src/App.tsx')],
        outfile: output,
        bundle: true,
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        plugins: [
          {
            name: 'external-packages',
            setup(b) {
              b.onResolve({ filter: /^[^./]/ }, (args) => ({
                path: require.resolve(args.path),
                external: true,
              }));
            },
          },
        ],
      });
      const { App } = await import(pathToFileURL(output).href);
      const { createRoot } = await import('react-dom/client');
      root = createRoot(win.document.getElementById('root')!);
      await act(async () => root!.render(createElement(App)));
      const body = () => win.document.body.textContent ?? '';
      const button = (name: string) => {
        const b = [...win.document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === name,
        );
        assert.ok(b, 'Missing button: ' + name);
        return b;
      };
      const click = async (name: string) => {
        await act(async () => {
          button(name).click();
        });
      };
      const settled = async () => {
        for (let i = 0; i < 200; i++) {
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
          });
          if (!win.document.querySelector('.spinner')) return;
        }
        assert.fail('Analysis did not finish: ' + body());
      };
      assert.match(body(), /这张照片拍得怎么样/);
      assert.ok(
        win.document.querySelector('[data-testid="file-input"][multiple]'),
      );
      const photoFile = () => {
        const p = demoPixels('detail', 600, 450),
          c = createCanvas(p.width, p.height),
          ctx = c.getContext('2d');
        const data = ctx.createImageData(p.width, p.height);
        data.data.set(p.data);
        ctx.putImageData(data, 0, 0);
        return new File([c.toBuffer('image/jpeg')], 'ordinary-photo.jpg', {
          type: 'image/jpeg',
        });
      };
      const fileInput = win.document.querySelector<HTMLInputElement>(
        '[data-testid="file-input"]',
      )!;
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [
          photoFile(),
          new File(['broken'], 'corrupt.jpg', { type: 'image/jpeg' }),
        ],
      });
      await act(async () =>
        fileInput.dispatchEvent(new win.Event('change', { bubbles: true })),
      );
      await settled();
      assert.match(body(), /技术参考分/);
      assert.match(body(), /清晰度/);
      assert.match(body(), /corrupt.jpg/);
      assert.equal(
        JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length,
        1,
      );
      await click('曝光风险');
      assert.match(body(), /红色：通道接近上限/);
      await click('查看 100% 原像素');
      assert.ok(win.document.querySelector('.crop-scroll canvas'));
      await click('镜头评价');
      assert.match(body(), /解析力分布/);
      assert.equal(win.document.querySelectorAll('.zone-cell').length, 9);
      await click('暗角');
      await settled();
      assert.match(body(), /平場|平场|纹理/);
      await click('体验平场测量');
      await settled();
      assert.match(body(), /EV/);
      assert.equal(
        win.document.querySelectorAll('.illumination-grid > div').length,
        49,
      );
      await click('畸变');
      await settled();
      await click('体验网格测量');
      await settled();
      assert.match(body(), /桶形/);
      await click('下载网格靶');
      assert.ok(downloads.some((d) => d.name.endsWith('grid-target.svg')));
      // The printable SVG is a real image, and can be decoded independently of the demo generator.
      assert.ok((await loadImage(Buffer.from(targetSvg('grid')))).width > 100);
      await click('查看对比');
      assert.match(body(), /ordinary-photo.jpg/);
      await click('编辑参数');
      const editor =
        win.document.querySelector<HTMLFormElement>('.metadata-form')!;
      const camera = editor.querySelector('input')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          win.HTMLInputElement.prototype,
          'value',
        )!.set!.call(camera, 'Sony A7');
        camera.dispatchEvent(new win.Event('input', { bubbles: true }));
      });
      await act(async () =>
        editor.dispatchEvent(
          new win.Event('submit', { bubbles: true, cancelable: true }),
        ),
      );
      assert.match(body(), /Sony A7/);
      await click('导出 CSV');
      await click('备份 JSON');
      assert.ok(downloads.some((d) => d.name === 'LensMark-comparison.csv'));
      const backup = downloads.find((d) => d.name === 'LensMark-records.json')!;
      assert.ok(JSON.parse(await backup.blob!.text()).records.length >= 3);
      const before = JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length;
      await act(async () =>
        win.document
          .querySelector<HTMLButtonElement>('button[aria-label^="删除记录"]')!
          .click(),
      );
      assert.equal(
        JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length,
        before - 1,
      );
      await click('撤销');
      assert.equal(
        JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length,
        before,
      );
      const importInput = win.document.querySelector<HTMLInputElement>(
        'input[accept=".json,application/json"]',
      )!;
      Object.defineProperty(importInput, 'files', {
        configurable: true,
        value: [
          new File([await backup.blob!.text()], 'backup.json', {
            type: 'application/json',
          }),
        ],
      });
      await act(async () => {
        importInput.dispatchEvent(new win.Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      assert.equal(
        JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length,
        before,
      );
      await click('比较镜头 / 光圈');
      assert.match(body(), /拍摄条件/);
      await click('拍摄指南');
      assert.ok(win.document.querySelector('dialog[open]'));
      await click('关闭');
      await click('照片评价');
      const slowFile = photoFile();
      Object.defineProperty(slowFile, 'arrayBuffer', {
        value: () => new Promise(() => {}),
      });
      const uploadInput = win.document.querySelector<HTMLInputElement>(
        '[data-testid="file-input"]',
      )!;
      Object.defineProperty(uploadInput, 'files', {
        configurable: true,
        value: [slowFile],
      });
      await act(async () =>
        uploadInput.dispatchEvent(new win.Event('change', { bubbles: true })),
      );
      await click('取消');
      assert.match(body(), /已取消/);
      assert.equal(
        JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length,
        before,
      );
      Object.defineProperty(uploadInput, 'files', {
        configurable: true,
        value: [photoFile()],
      });
      await act(async () =>
        uploadInput.dispatchEvent(new win.Event('change', { bubbles: true })),
      );
      await settled();
      assert.equal(
        JSON.parse(win.localStorage.getItem(RECORDS_KEY)!).length,
        before + 1,
      );
      await act(async () => root!.unmount());
      root = null;
      root = createRoot(win.document.getElementById('root')!);
      await act(async () => root!.render(createElement(App)));
      assert.match(body(), new RegExp('照片对比 · ' + (before + 1)));
    } finally {
      if (root) await act(async () => root!.unmount());
      URL.createObjectURL = createUrl;
      URL.revokeObjectURL = revokeUrl;
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      dom.window.close();
      await rm(temp, { recursive: true, force: true });
    }
  },
);
