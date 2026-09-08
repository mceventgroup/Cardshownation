'use client'

import { useEffect } from 'react'
import { useEditorStore } from '../store/index'
import { CloudQuotaExceededError, CloudRequestError, CloudRevisionConflictError, getCloudSession } from '../lib/cloud-layouts'
import { saveCurrentShow } from '../lib/save-show'

/** One writer, trailing saves, bounded retries, and no overwriting newer revisions. */
export function useCloudAutosave() {
  const hydrated = useEditorStore(s => s.hasHydratedFromStorage)
  useEffect(() => {
    if (!hydrated) return
    let disposed = false
    let available = false
    let running = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let generation = useEditorStore.getState().documentGeneration
    let baseline = useEditorStore.getState().currentDocumentHash
    let blockedGeneration: number | null = null
    let firstDirtyAt = 0
    let lastAttemptAt = 0
    let retryAt = 0
    let failures = 0

    function schedule() {
      if (disposed) return
      const state = useEditorStore.getState()
      if (state.documentGeneration !== generation) {
        generation = state.documentGeneration
        baseline = state.currentDocumentHash
        blockedGeneration = null
        firstDirtyAt = 0
        retryAt = 0
        failures = 0
      }
      if (timer) clearTimeout(timer)
      timer = undefined
      const dirty = state.activeCloudLayoutId
        ? state.currentDocumentHash !== state.lastCloudSyncHash
        : available && state.currentDocumentHash !== baseline
      if (!state.hasHydratedFromStorage || !dirty || blockedGeneration === generation) return
      if (!firstDirtyAt) firstDirtyAt = Date.now()
      if (running) return
      if (!retryAt) useEditorStore.setState({ cloudSaveStatus: 'waiting', cloudSaveError: null })
      const when = Math.max(
        Math.min(Date.now() + 3000, firstDirtyAt + 15000),
        lastAttemptAt + 5000,
        retryAt,
      )
      timer = setTimeout(() => { void save() }, Math.max(0, when - Date.now()))
    }

    async function save() {
      if (disposed || running) return
      running = true
      const savedGeneration = generation
      lastAttemptAt = Date.now()
      firstDirtyAt = 0
      try {
        await saveCurrentShow(true)
        retryAt = 0
        failures = 0
      } catch (error) {
        if (useEditorStore.getState().documentGeneration === savedGeneration) {
          const conflict = error instanceof CloudRevisionConflictError
          const stop = conflict || error instanceof CloudQuotaExceededError || (error instanceof CloudRequestError && [401, 403, 400, 413].includes(error.status))
          if (stop) blockedGeneration = savedGeneration
          else retryAt = Date.now() + Math.max(
            Math.min(60000, 15000 * 2 ** failures++),
            error instanceof CloudRequestError ? error.retryAfterMs : 0,
          )
          useEditorStore.setState({
            cloudSaveStatus: 'error',
            cloudSaveError: conflict
              ? 'Cloud autosave paused: this show changed on another device. Open shows to reload that version, or download a backup of your edits.'
              : stop && error instanceof Error
                ? error.message
                : 'Cloud save could not finish. Retrying automatically; check the device save status for your local copy.',
          })
        }
      } finally {
        running = false
        if (!disposed) schedule()
      }
    }

    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.cloudSaveStatus === 'saved' && previous.cloudSaveStatus !== 'saved') blockedGeneration = null
      if (state.currentDocumentHash !== previous.currentDocumentHash || state.documentGeneration !== previous.documentGeneration || state.lastCloudSyncHash !== previous.lastCloudSyncHash || state.hasHydratedFromStorage !== previous.hasHydratedFromStorage) schedule()
    })
    void getCloudSession().then(session => { available = session.available && session.authenticated; schedule() }).catch(() => { /* Linked shows still attempt to save and expose failures. */ })
    const online = () => { retryAt = 0; schedule() }
    window.addEventListener('online', online)
    schedule()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('online', online)
    }
  }, [hydrated])
}
