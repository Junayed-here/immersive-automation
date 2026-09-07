/**
 * Runs zero-arg async task thunks with at most `limit` in flight at once.
 * Small hand-rolled substitute for p-limit - avoided pulling in a dependency
 * for something this contained.
 */
export async function runWithConcurrencyLimit(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex;
      nextIndex += 1;
      // eslint-disable-next-line no-await-in-loop
      results[current] = await tasks[current]();
    }
  }

  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
