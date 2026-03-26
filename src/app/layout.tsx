import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'Lotus Connect Portal',
    template: '%s | Lotus Connect Portal',
  },
  description: 'Centralized procurement and order management portal for Lotus Connect',
  keywords: ['procurement', 'orders', 'management', 'lotus connect'],
  authors: [{ name: 'Halldon Inc' }],
  creator: 'Halldon Inc',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lotus-connect-portal.com',
    title: 'Lotus Connect Portal',
    description: 'Centralized procurement and order management portal',
    siteName: 'Lotus Connect Portal',
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
