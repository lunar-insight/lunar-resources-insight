export class CanceledError extends Error {
  constructor() {
    super('Request canceled');
    this.name = 'CanceledError';
  }
}

interface QueuedTask {
  group: string;
  run: (signal: AbortSignal) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  controller: AbortController;
}

/**
 * Runs at most `concurrency` tasks at once, in the order they were queued.
 * While paused, queued tasks wait and running ones finish. Canceling a group
 * aborts its running tasks and drops its queued ones.
 */
export class RequestQueue {
  private queue: QueuedTask[] = [];
  private running = new Set<QueuedTask>();
  private paused = false;

  constructor(private readonly concurrency: number) {}

  run<T>(group: string, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        group,
        run: task,
        resolve: resolve as (value: unknown) => void,
        reject,
        controller: new AbortController(),
      });
      this.next();
    });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.next();
  }

  isPaused(): boolean {
    return this.paused;
  }

  cancelGroup(group: string): void {
    this.queue = this.queue.filter(task => {
      if (task.group !== group) return true;
      task.reject(new CanceledError());
      return false;
    });
    this.running.forEach(task => {
      if (task.group === group) task.controller.abort();
    });
  }

  get size(): { queued: number; running: number } {
    return { queued: this.queue.length, running: this.running.size };
  }

  private next(): void {
    while (!this.paused && this.running.size < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running.add(task);
      task.run(task.controller.signal)
        .then(
          value => (task.controller.signal.aborted ? task.reject(new CanceledError()) : task.resolve(value)),
          error => task.reject(task.controller.signal.aborted ? new CanceledError() : error),
        )
        .finally(() => {
          this.running.delete(task);
          this.next();
        });
    }
  }
}
