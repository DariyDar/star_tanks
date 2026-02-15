export class IndexMap {
  private idToIndex = new Map<string, number>()
  private indexToId: Array<string | null>
  private max: number

  constructor(max = 30) {
    this.max = max
    this.indexToId = new Array(max).fill(null)
  }

  assign(id: string): number {
    if (this.idToIndex.has(id)) return this.idToIndex.get(id) as number
    for (let i = 0; i < this.max; i++) {
      if (this.indexToId[i] === null) {
        this.indexToId[i] = id
        this.idToIndex.set(id, i)
        return i
      }
    }
    throw new Error('No free index')
  }

  release(id: string): void {
    const idx = this.idToIndex.get(id)
    if (idx === undefined) return
    this.idToIndex.delete(id)
    this.indexToId[idx] = null
  }

  getIndex(id: string): number {
    return this.idToIndex.get(id) ?? -1
  }

  getId(index: number): string | null {
    if (index < 0 || index >= this.max) return null
    return this.indexToId[index]
  }

  getAll(): Array<{ id: string; index: number }> {
    const out: Array<{ id: string; index: number }> = []
    for (let i = 0; i < this.indexToId.length; i++) {
      const id = this.indexToId[i]
      if (id !== null) out.push({ id, index: i })
    }
    return out
  }
}

export default IndexMap
