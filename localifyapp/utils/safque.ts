let queue = Promise.resolve();

export function enqueueSAFWrite<T>(
  task: () => Promise<T>
): Promise<T> {
  const result = queue.then(task);

  queue = result
    .then(() => undefined)
    .catch(() => undefined);

  return result;
}