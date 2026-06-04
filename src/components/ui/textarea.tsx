import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-[#393c41] bg-[#171a20] px-3 py-2 text-sm text-white shadow-sm placeholder:text-[#777777] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3e6ae1] focus-visible:border-[#3e6ae1] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
