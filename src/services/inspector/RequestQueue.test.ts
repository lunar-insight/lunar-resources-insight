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
