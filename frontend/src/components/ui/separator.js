import * as React from "react"

const Separator = React.forwardRef(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <div
    ref={ref}
    role={decorative ? "none" : "separator"}
    aria-orientation={orientation}
    className={`separator ${className || ''}`}
    {...props}
  />
))
Separator.displayName = "Separator"

export { Separator }
