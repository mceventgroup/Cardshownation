import type { ReviewImage } from '../components/editor/BuildingPlanReview'
export interface PlanDraft { pages: ReviewImage[]; opacity: number; arrangement: string; activePage: number; savedAt: number }
// IndexedDB keeps large drawing images out of the layout's localStorage quota.
let queue: Promise<unknown> = Promise.resolve()
export function planDraft(action: 'read' | 'write' | 'delete', key: string, value?: PlanDraft): Promise<PlanDraft | undefined> {
  const operation = queue.catch(() => {}).then(() => new Promise<PlanDraft | undefined>((resolve, reject) => {
    const request = indexedDB.open('floorplanner-plan-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('drafts', action === 'read' ? 'readonly' : 'readwrite'), store = transaction.objectStore('drafts')
      const result = action === 'read' ? store.get(key) : action === 'write' ? store.put(value, key) : store.delete(key)
      transaction.oncomplete = () => { db.close(); resolve(action === 'read' ? result.result as PlanDraft | undefined : undefined) }
      transaction.onerror = () => { db.close(); reject(transaction.error) }
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Draft save interrupted.')) }
    }
  }))
  queue = operation
  return operation
}
