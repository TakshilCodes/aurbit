import type { ReactNode } from "react";

export function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[1.125rem] shrink-0"
      viewBox="0 0 18 18"
    >
      <path
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.91-2.258c-.805.54-1.835.859-3.046.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 text-[0.6875rem] font-medium tracking-wide text-muted uppercase before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
      role="separator"
    >
      {children}
    </div>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 space-y-2 text-center text-sm leading-6 text-secondary [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-white [&_a:hover]:underline motion-reduce:[&_a]:transition-none">
      {children}
    </div>
  );
}
