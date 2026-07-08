export const RESOLVE_CONCURRENCY = 4;
export const DOWNLOAD_CONCURRENCY = 3;

export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    async function worker() {
        while (cursor < items.length) {
            const current = cursor++;
            results[current] = await fn(items[current], current);
        }
    }
    const workerCount = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}