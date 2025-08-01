import * as React from "react"

const Button = React.forwardRef(({ className, disabled, ...props }, ref) => {
  return (
    <button
      className={`button ${className || ''}`}
      ref={ref}
      disabled={disabled}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
