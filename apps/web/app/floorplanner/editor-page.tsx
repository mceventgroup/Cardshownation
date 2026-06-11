"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { DocumentSlice } from "@floorplanner/lib/persistence";

const EditorShell = dynamic(() => import("@floorplanner/components/editor/EditorShell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[70vh] items-center justify-center bg-slate-200 text-sm text-slate-600">
      Loading editor...
    </div>
  ),
});

class FloorplannerErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[Floorplanner] Editor crashed:", error);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[70vh] items-center justify-center bg-slate-100 px-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              Floorplanner Error
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              The editor crashed while loading.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {this.state.error.message || "An unexpected client-side error occurred."}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type FloorplanEditorPageProps = {
  cloudBasePath: string;
  initialCloudLayout?: {
    id: string;
    name: string;
    revision: number;
    data: DocumentSlice;
  } | null;
  showLabel: string;
  storageNamespace: string;
};

export function FloorplanEditorPage(props: FloorplanEditorPageProps) {
  return (
    <FloorplannerErrorBoundary>
      <EditorShell {...props} />
    </FloorplannerErrorBoundary>
  );
}
