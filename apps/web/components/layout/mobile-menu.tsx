"use client";

import { Menu, X } from "lucide-react";
import { type MouseEvent, useEffect, useRef } from "react";

export function MobileMenu({
  children,
  label = "Menu",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeMenu(restoreFocus = false) {
      const details = detailsRef.current;
      if (!details?.open) return;

      details.open = false;
      if (restoreFocus) summaryRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        closeMenu();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu(true);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleMenuClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary ref={summaryRef} className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors marker:content-none hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
        <Menu className="h-4 w-4 group-open:hidden" aria-hidden="true" />
        <X className="hidden h-4 w-4 group-open:block" aria-hidden="true" />
        {label}
      </summary>
      <div onClick={handleMenuClick} className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        {children}
      </div>
    </details>
  );
}
