"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

type FancyDialogAction = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
};

type FancyDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  actions?: FancyDialogAction[];
  children?: ReactNode;
  widthClassName?: string;
  closeOnOverlayClick?: boolean;
};

function actionClassName(variant: FancyDialogAction["variant"]) {
  if (variant === "primary") {
    return "border-cyan-500/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30";
  }

  if (variant === "danger") {
    return "border-rose-500/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30";
  }

  return "border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800";
}

export function FancyDialog({
  open,
  title,
  description,
  onClose,
  actions = [],
  children,
  widthClassName = "max-w-lg",
  closeOnOverlayClick = true,
}: FancyDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={closeOnOverlayClick ? onClose : undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full ${widthClassName} overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 shadow-2xl`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl text-slate-100">{title}</h3>
                {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:bg-slate-800"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {children ? <div className="relative mt-4">{children}</div> : null}

            {actions.length ? (
              <div className="relative mt-5 flex flex-wrap justify-end gap-2">
                {actions.map((action, index) => (
                  <button
                    key={`${action.label}-${index}`}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => void action.onClick()}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${actionClassName(action.variant)}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
