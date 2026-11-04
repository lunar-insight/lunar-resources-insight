// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { RequestQueue, CanceledError } from './RequestQueue'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('RequestQueue', () => {
  it('cancels the requests of one group and lets the others finish', async () => {
    const queue = new RequestQueue(2)
    const gates = [deferred<number>(), deferred<number>()]
    const canceled = queue.run('a', () => gates[0].promise)
    const kept = queue.run('b', () => gates[1].promise)
    await flush()

    queue.cancelGroup('a')
    gates[0].resolve(1)
    gates[1].resolve(2)
    await expect(canceled).rejects.toBeInstanceOf(CanceledError)
    await expect(kept).resolves.toBe(2)
  })

  it('runs at most the concurrency at once, in order', async () => {
    const queue = new RequestQueue(2)
    const gates = [deferred(), deferred(), deferred()]
    const started: number[] = []
    const results = gates.map((gate, i) => queue.run('a', async () => { started.push(i); await gate.promise; return i }))

    await flush()
    expect(started).toEqual([0, 1])
    expect(queue.size).toEqual({ queued: 1, running: 2 })

    gates[0].resolve()
    await flush()
    expect(started).toEqual([0, 1, 2])

    gates[1].resolve()
    gates[2].resolve()
    expect(await Promise.all(results)).toEqual([0, 1, 2])
    expect(queue.size).toEqual({ queued: 0, running: 0 })
  })

  it('holds queued tasks while paused', async () => {
    const queue = new RequestQueue(4)
    queue.pause()
    expect(queue.isPaused()).toBe(true)
    let ran = false
    const result = queue.run('a', async () => { ran = true; return 'done' })

    await flush()
    expect(ran).toBe(false)

    queue.resume()
    expect(await result).toBe('done')
  })

  it('cancels a group: drops queued tasks and aborts running ones', async () => {
    const queue = new RequestQueue(1)
    const gate = deferred()
    let signal: AbortSignal | undefined
    const running = queue.run('a', async s => { signal = s; await gate.promise; return 1 })
    const queued = queue.run('a', async () => 2)
    const other = queue.run('b', async () => 3)

    await flush()
    queue.cancelGroup('a')
    expect(signal?.aborted).toBe(true)
    await expect(queued).rejects.toBeInstanceOf(CanceledError)

    gate.resolve()
    await expect(running).rejects.toBeInstanceOf(CanceledError)
    expect(await other).toBe(3)
  })

  it('runs a front task ahead of those queued', async () => {
    const queue = new RequestQueue(1)
    const gate = deferred()
    const started: string[] = []
    const task = (name: string) => async () => { started.push(name) }
    const first = queue.run('a', async () => { started.push('running'); await gate.promise })
    const queued = queue.run('a', task('queued'))
    const front = queue.run('a', task('front'), { front: true })

    await flush()
    expect(started).toEqual(['running'])
    gate.resolve()
    await Promise.all([first, queued, front])
    expect(started).toEqual(['running', 'front', 'queued'])
  })

  it('holds a front task while paused', async () => {
    const queue = new RequestQueue(4)
    queue.pause()
    let ran = false
    const front = queue.run('a', async () => { ran = true }, { front: true })
    await flush()
    expect(ran).toBe(false)
    queue.resume()
    await front
    expect(ran).toBe(true)
  })

  it('cancels a queued front task with its group', async () => {
    const queue = new RequestQueue(1)
    const gate = deferred()
    const running = queue.run('b', () => gate.promise)
    const front = queue.run('a', async () => 1, { front: true })
    queue.cancelGroup('a')
    await expect(front).rejects.toBeInstanceOf(CanceledError)
    gate.resolve()
    await running
  })

  it('passes a task failure on, and continues', async () => {
    const queue = new RequestQueue(1)
    const failing = queue.run('a', async () => { throw new Error('boom') })
    const next = queue.run('a', async () => 'ok')
    await expect(failing).rejects.toThrow('boom')
    expect(await next).toBe('ok')
  })

  it('reports a task failing after its abort as canceled', async () => {
    const queue = new RequestQueue(1)
    const gate = deferred()
    const task = queue.run('a', async () => { await gate.promise; throw new Error('aborted fetch') })
    await flush()
    queue.cancelGroup('a')
    gate.resolve()
    await expect(task).rejects.toBeInstanceOf(CanceledError)
  })
})
