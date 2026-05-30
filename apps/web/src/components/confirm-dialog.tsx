'use client';

import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses the destructive style. */
  destructive?: boolean;
}

type Resolver = (ok: boolean) => void;

const Ctx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Drop-in replacement for `window.confirm()` that renders a shadcn
 * AlertDialog. Wrap the app in <ConfirmProvider/> once, then call
 * `const confirm = useConfirm()` and `await confirm({ title, description })`
 * from any client component. Resolves true on confirm, false on cancel.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog
        open={opts !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogContent>
          {opts && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{opts.title}</AlertDialogTitle>
                {opts.description && (
                  <AlertDialogDescription>{opts.description}</AlertDialogDescription>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => settle(false)}>
                  {opts.cancelLabel ?? 'Cancel'}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => settle(true)}
                  className={
                    opts.destructive
                      ? 'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20'
                      : undefined
                  }
                >
                  {opts.confirmLabel ?? 'Continue'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return ctx;
}
