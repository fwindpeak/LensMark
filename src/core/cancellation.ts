/** Also settles callers when terminating a Worker leaves its internal promise unresolved. */
export function abortable<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('已取消', 'AbortError'));
    const done = () => signal.removeEventListener('abort', abort);
    promise.then(
      (value) => {
        done();
        if (signal.aborted) abort();
        else resolve(value);
      },
      (error) => {
        done();
        reject(error);
      },
    );
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
