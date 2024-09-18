import IBullet from '../domain/ibullet'

export type RawIBullet = Record<string, any>
export type RawCatalog = Record<string, RawIBullet>

/**
 * The interface all storage needs to implement.
 * This allows Taskbook to switch storage backend.
 */
export default interface Storage {
  /**
   * Retrieve all items in the bucket
   * TODO: handle not found
   */
  all(bucket?: string): RawCatalog

  /**
   * Retrieve a single item from a bucket.
   * TODO: handle not found
   */
  get(key: string, bucket?: string): RawIBullet | null

  /**
   * Update a single item from a bucket.
   */
  upsert(item: IBullet, key?: string, bucket?: string): void

  /**
   * Sync an entire catalog to the underlying storage.
   */
  commit(bucket?: string): void

  delete(key: string, bucket?: string): void
}
