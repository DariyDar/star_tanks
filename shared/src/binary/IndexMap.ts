/**
 * IndexMap manages bidirectional mapping between tank IDs (strings) and binary indices (uint8)
 * Supports up to 255 tanks (though game max is 30)
 */
export class IndexMap {
  private idToIndex = new Map<string, number>()
  private indexToId = new Map<number, string>()
  private freeIndices: number[] = []
  private nextIndex = 0

  /**
   * Assigns a binary index to a tank ID
   * @param id Tank ID (socket.id or bot_N)
   * @returns Assigned index (0-254)
   */
  assign(id: string): number {
    if (this.idToIndex.has(id)) {
      return this.idToIndex.get(id)!
    }

    let index: number
    if (this.freeIndices.length > 0) {
      index = this.freeIndices.pop()!
    } else {
      if (this.nextIndex > 254) {
        throw new Error('IndexMap: No free indices available (max 255)')
      }
      index = this.nextIndex++
    }

    this.idToIndex.set(id, index)
    this.indexToId.set(index, id)
    return index
  }

  /**
   * Releases an index when a tank leaves
   * @param id Tank ID to release
   */
  release(id: string): void {
    const index = this.idToIndex.get(id)
    if (index === undefined) return

    this.idToIndex.delete(id)
    this.indexToId.delete(index)
    this.freeIndices.push(index)
  }

  /**
   * Gets the index for a tank ID
   * @param id Tank ID
   * @returns Index or undefined if not found
   */
  getIndex(id: string): number | undefined {
    return this.idToIndex.get(id)
  }

  /**
   * Gets the tank ID for an index
   * @param index Binary index
   * @returns Tank ID or undefined if not found
   */
  getId(index: number): string | undefined {
    return this.indexToId.get(index)
  }

  /**
   * Gets all current mappings
   * @returns Array of {id, index} objects
   */
  getAll(): Array<{ id: string; index: number }> {
    return Array.from(this.idToIndex.entries()).map(([id, index]) => ({ id, index }))
  }

  /**
   * Gets the number of active mappings
   */
  get size(): number {
    return this.idToIndex.size
  }
}
