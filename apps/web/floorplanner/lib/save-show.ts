import { useEditorStore } from '../store/index'
import { extractDocumentSlice, saveToLocalStorage } from './persistence'
import { getCloudSession, saveCloudLayout } from './cloud-layouts'

let pendingSave: Promise<string> | null = null

/** Save updates the current destination. Account copies are an explicit choice. */
export function saveCurrentShow(toAccount = false): Promise<string> {
  if (pendingSave) return pendingSave
  const requestGeneration = useEditorStore.getState().documentGeneration
  const cloudRequest = toAccount || Boolean(useEditorStore.getState().activeCloudLayoutId)
  pendingSave = (async () => {
    const state = useEditorStore.getState()
    const cloudId = state.activeCloudLayoutId
    const generation = state.documentGeneration
    if (!toAccount && !cloudId) {
      state.saveCurrentLayout()
      return 'Saved on this device'
    }
    if (!cloudId) {
      const session = await getCloudSession()
      if (!session.available || !session.authenticated) {
        throw new Error('Account saving is unavailable right now. You can still save on this device or download a backup.')
      }
    }
    if (useEditorStore.getState().documentGeneration !== generation) return 'Show changed before saving'
    useEditorStore.setState({ cloudSaveStatus: 'saving', cloudSaveError: null })
    const data = extractDocumentSlice(useEditorStore.getState())
    const savedHash = JSON.stringify(data)
    const saved = await saveCloudLayout({
      id: cloudId,
      name: data.settings.eventName.trim() || 'Untitled show',
      expectedRevision: state.activeCloudLayoutRevision,
      data,
    })
    if (useEditorStore.getState().documentGeneration !== generation) return 'Previous show saved to your account'
    // Edits made while the request was running must still count as unsaved.
    useEditorStore.getState().markCloudSaved({ ...saved, savedHash })
    useEditorStore.setState({ cloudSaveStatus: 'saved', cloudSaveError: null })
    saveToLocalStorage(extractDocumentSlice(useEditorStore.getState()))
    return useEditorStore.getState().currentDocumentHash === savedHash
      ? 'Saved to your account'
      : 'Saved to your account; newer edits still need saving'
  })().catch(error => {
    if (cloudRequest && useEditorStore.getState().documentGeneration === requestGeneration) {
      useEditorStore.setState({ cloudSaveStatus: 'error', cloudSaveError: error instanceof Error ? error.message : 'Cloud save failed. Please retry.' })
    }
    throw error
  }).finally(() => { pendingSave = null })
  return pendingSave
}

export function keepCurrentDeviceShow(): void {
  const state = useEditorStore.getState()
  if (state.activeDocumentSource === 'browser') state.saveCurrentLayout()
}
