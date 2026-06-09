import type { BackgroundImage, BackgroundImageId } from '@/domain/types'

const DB_NAME = 'floorplanner-assets'
const DB_VERSION = 1
const STORE_NAME = 'background-images'

type StoredBackgroundImage = {
  id: string
  dataUrl: string
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null)

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null

  try {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = await callback(store)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return result
  } catch {
    return null
  } finally {
    db.close()
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function canPersistBackgroundImagesExternally(): boolean {
  return hasIndexedDb()
}

export async function saveBackgroundImagesExternally(
  images: Record<string, BackgroundImage>,
): Promise<void> {
  const list = Object.values(images)
  if (list.length === 0) return

  await withStore('readwrite', async store => {
    await Promise.all(list.map(image => requestToPromise(
      store.put({ id: image.id, dataUrl: image.dataUrl } satisfies StoredBackgroundImage),
    )))
  })
}

export async function loadBackgroundImagesExternally(
  images: Record<string, BackgroundImage>,
): Promise<Record<string, BackgroundImage>> {
  const idsNeedingData = Object.values(images)
    .filter(image => !image.dataUrl)
    .map(image => image.id)

  if (idsNeedingData.length === 0) return images

  const loaded = await withStore('readonly', async store => {
    const entries = await Promise.all(idsNeedingData.map(async id => {
      const record = await requestToPromise(store.get(id)) as StoredBackgroundImage | undefined
      return record ? [id, record.dataUrl] as const : null
    }))
    const restored = new Map<BackgroundImageId, string>()
    for (const entry of entries) {
      if (!entry) continue
      restored.set(entry[0], entry[1])
    }
    return restored
  })

  if (!loaded) return images

  const next: Record<string, BackgroundImage> = {}
  for (const image of Object.values(images)) {
    next[image.id] = loaded.has(image.id)
      ? { ...image, dataUrl: loaded.get(image.id)! }
      : image
  }
  return next
}

export async function deleteBackgroundImagesExternally(imageIds: string[]): Promise<void> {
  if (imageIds.length === 0) return

  await withStore('readwrite', async store => {
    await Promise.all(imageIds.map(id => requestToPromise(store.delete(id))))
  })
}

export async function clearAllBackgroundImagesExternally(): Promise<void> {
  await withStore('readwrite', async store => {
    await requestToPromise(store.clear())
  })
}
