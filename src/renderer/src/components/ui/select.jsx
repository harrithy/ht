import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronDown } from "lucide-react";

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "flex h-8 w-full appearance-none rounded-lg border border-white/10 bg-slate-800/60 px-2.5 py-1 pr-8 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 focus-visible:border-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 opacity-70" />
    </div>
  );
});
Select.displayName = "Select";

export { Select };
