'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  User,
  Settings,
  LogOut,
  FileText,
  Receipt,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { cn, debounce } from '@/lib/utils'
import { NotificationDropdown } from '@/components/shared/notification-dropdown'

interface SearchResult {
  id: string
  type: 'client' | 'request' | 'quote' | 'order'
  title: string
  subtitle: string
  status: string | null
  url: string
}

interface SearchResponse {
  success: boolean
  data?: {
    clients: SearchResult[]
    requests: SearchResult[]
    quotes: SearchResult[]
    purchaseOrders: SearchResult[]
    totalResults: number
    query: string
  }
}

interface TopBarProps {
  className?: string
}

const typeIcons: Record<string, typeof FileText> = {
  client: Users,
  request: FileText,
  quote: Receipt,
  order: ShoppingCart,
}

const typeLabels: Record<string, string> = {
  client: 'Client',
  request: 'Request',
  quote: 'Quote',
  order: 'Order',
}

export function TopBar({ className }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([])
        setSearchOpen(false)
        return
      }

      setSearchLoading(true)
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=5`)
        const result: SearchResponse = await response.json()

        if (result.success && result.data) {
          const allResults: SearchResult[] = [
            ...result.data.clients,
            ...result.data.requests,
            ...result.data.quotes,
            ...result.data.purchaseOrders,
          ]
          setSearchResults(allResults)
          setSearchOpen(allResults.length > 0)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearchLoading(false)
      }
    }, 300),
    []
  )

  useEffect(() => {
    performSearch(searchQuery)
  }, [searchQuery, performSearch])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.length >= 2) {
      performSearch(searchQuery)
    }
  }

  return (
    <header className={cn('border-b bg-background', className)}>
      <div className="flex items-center justify-between px-6 py-4">
        {/* Search */}
        <div className="flex-1 max-w-md" ref={searchRef}>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clients, requests, orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              className="pl-10"
            />

            {/* Search Results Dropdown */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                {searchLoading ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">No results found</div>
                ) : (
                  searchResults.map((result) => {
                    const Icon = typeIcons[result.type] || FileText
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-start space-x-3 border-b last:border-b-0"
                        onClick={() => handleResultClick(result)}
                      >
                        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium truncate">{result.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {typeLabels[result.type]}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </form>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          {session?.user?.id && (
            <NotificationDropdown userId={session.user.id} />
          )}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-medium text-primary">
                    {session?.user.name?.charAt(0) || 'U'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {session?.user.role.toLowerCase()}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              {(session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER') && (
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
