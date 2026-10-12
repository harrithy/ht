import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold hover:brightness-110 active:scale-[0.98] shadow-lg shadow-emerald-500/20",
        destructive:
          "bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold hover:brightness-110 shadow-lg shadow-pink-500/20",
        outline:
          "border border-white/10 bg-slate-900/40 hover:bg-white/10 text-slate-200 hover:text-white",
        secondary:
          "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/5",
        ghost: "hover:bg-white/10 text-slate-400 hover:text-slate-100",
        link: "text-emerald-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
