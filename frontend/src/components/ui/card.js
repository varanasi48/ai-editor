import * as React from "react"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`card ${className || ''}`}
    {...props}
  />
))
Card.displayName = "Card"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={`card-content ${className || ''}`} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardContent }
