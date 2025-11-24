import React from "react";

export type ThProps = React.ComponentProps<'th'>;
export function Th({ children, className = "", ...rest }: ThProps) {
  return <th {...rest} className={`text-left p-3 ${className}`}>{children}</th>;
}

export type TdProps = React.ComponentProps<'td'>;
export function Td({ children, className = "", ...rest }: TdProps) {
  return <td {...rest} className={`p-3 ${className}`}>{children}</td>;
}

