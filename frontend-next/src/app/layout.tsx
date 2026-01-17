import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sumurai',
  description: 'Personal finance with provider-aware onboarding'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}
