'use client'

import dynamic from 'next/dynamic'

const EditorShell = dynamic(() => import('@/components/editor/EditorShell'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-100 text-gray-500 text-sm">
      Loading editor...
    </div>
  ),
})

export default function Home() {
  return <EditorShell />
}
