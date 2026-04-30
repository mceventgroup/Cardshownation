'use client'

import dynamic from 'next/dynamic'

const EditorShell = dynamic(() => import('@/components/editor/EditorShell'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-200 text-sm text-slate-600">
      Loading editor...
    </div>
  ),
})

export default function Home() {
  return <EditorShell />
}
