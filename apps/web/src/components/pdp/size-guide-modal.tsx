"use client";

import React, { useState, useRef } from "react";
import { Ruler, X } from "lucide-react";
import type { ApiSizeGuide, ApiSizeGuideColumn } from "@/lib/api";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface SizeGuideModalProps {
  sizeGuide: ApiSizeGuide | null;
  productName: string;
  className?: string;
}

export function SizeGuideModal({ sizeGuide, productName, className = "" }: SizeGuideModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    setIsOpen(false);
  };

  const modalRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: handleClose,
    triggerRef,
  });

  // If no size guide exists or rows are empty, render nothing (no fake tables)
  if (!sizeGuide || !Array.isArray(sizeGuide.rows) || sizeGuide.rows.length === 0) {
    return null;
  }

  // Parse columns safely
  const columns: ApiSizeGuideColumn[] = Array.isArray(sizeGuide.columns)
    ? (sizeGuide.columns as ApiSizeGuideColumn[])
    : [];

  return (
    <div className={className}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-sans font-medium text-accent-storefront hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-storefront rounded"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Size Guide</span>
      </button>

      {/* Accessible Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-guide-modal-title"
          onClick={handleClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-in fade-in"
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl rounded-xl bg-surface border border-border shadow-2xl p-6 sm:p-8 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2
                  id="size-guide-modal-title"
                  className="font-editorial text-2xl text-ink font-normal tracking-tight"
                >
                  Size Guide
                </h2>
                <p className="font-sans text-xs text-text-muted mt-0.5">
                  Measurements for {productName}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-text-muted hover:text-ink rounded-md hover:bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
                aria-label="Close size guide"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Tabular Content */}
            <div className="overflow-x-auto py-4 flex-1">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-soft">
                    <th scope="col" className="py-2.5 px-3 font-semibold text-ink">
                      Size
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col.key || col.label}
                        scope="col"
                        className="py-2.5 px-3 font-semibold text-ink"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sizeGuide.rows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-surface-soft/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-ink">{row.label}</td>
                      {columns.map((col) => {
                        const val =
                          row.values && typeof row.values === "object"
                            ? (row.values as Record<string, string | number>)[col.key]
                            : "";
                        return (
                          <td key={col.key} className="py-2.5 px-3 text-text-muted">
                            {val !== undefined && val !== null ? String(val) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-sans font-medium text-ink bg-surface-soft hover:bg-surface-soft/80 border border-border rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
