import EditorShell from '@/components/editor/EditorShell'

// Phase 1: editor loads directly at root with in-memory state.
// Phase 6 will add routing, auth, and layout IDs.
export default function Home() {
  return <EditorShell />
}
