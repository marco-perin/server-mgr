import WaitQueue from 'wait-queue';

type AsyncQueueTask = Promise<void> | Promise<Error | boolean | undefined>;

export type WaitQueueStop = WaitQueue<AsyncQueueTask>;

async function stopTask() {
  return new Promise((resolve: (val: boolean) => void) => {
    resolve(true);
  });
}

/**
 * @class
 * @name AsyncQueue
 * @description
 * Async queue to run tasks in a sequential way.
 * If no tasks are present in the queue, it just waits for new ones.
 * To best manage the queue, save the promise returned from the `run()` function,
 *  and wait for it in the cleanup function of your code.
 * @example
 *  const queue = new AsyncQueue();
 *  // ...
 *  const queuePromise = queue.run().catch((e: unknown) => {
 *    console.log('ERROR RUNNING QUEUE', e);
 *  });
 *  // ...
 *  // on closeup:
 *  await queuePromise
 */
export class AsyncQueue {
  private queue: WaitQueueStop;
  constructor() {
    this.queue = new WaitQueue();
  }

  /**
   * Call this in a non-async context to start running
   *  the tasks in a sequential way.
   * If no tasks are present in the queue, it just waits for new ones.
   * To best manage the queue, save the promise returned from this task,
   *  and wait for it in the cleanup function of your code.
   * @example
   *  const queuePromise = queue.run().catch((e: unknown) => {
   *    console.log('ERROR RUNNING QUEUE', e);
   *  });
   *  // ...
   *  // on closeup:
   *  await queuePromise
   */
  public async run() {
    await this.queue.pop().then(async (task) => {
      const res = await task;
      // If we get  true here, it's beacuse we either had an Error or a stopTask()
      //  so stop the waiting.
      if (!res) await this.run();
    });
  }

  /**
   * Push a new task in the queue.
   * @param task The task to run
   */
  public push(task: AsyncQueueTask) {
    this.queue.push(task);
  }

  /**
   * Stop the queue from waiting for, or processing tasks
   */
  public stop() {
    this.queue.push(stopTask());
  }
}
