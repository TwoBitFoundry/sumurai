import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sumaura',
  description: 'Personal finance with provider-aware onboarding'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
