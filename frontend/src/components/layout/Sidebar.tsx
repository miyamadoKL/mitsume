import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Database,
  FileCode,
  History,
  LayoutDashboard,
  LogOut,
  Bell,
  AlertTriangle,
  CalendarClock,
  Shield,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navigation = [
  { key: 'nav.query', href: '/query', icon: Database },
  { key: 'nav.savedQueries', href: '/saved', icon: FileCode },
  { key: 'nav.history', href: '/history', icon: History },
  { key: 'nav.dashboards', href: '/dashboards', icon: LayoutDashboard },
  { key: 'nav.alerts', href: '/alerts', icon: AlertTriangle },
  { key: 'nav.subscriptions', href: '/subscriptions', icon: CalendarClock },
  { key: 'nav.notifications', href: '/notifications', icon: Bell },
]

const adminNavigation = [
  { key: 'nav.roles', href: '/admin/roles', icon: Shield },
  { key: 'nav.users', href: '/admin/users', icon: Users },
]

export const Sidebar: React.FC = () => {
  const location = useLocation()
  const { user, logout, isAdmin } = useAuthStore()
  const { t } = useTranslation()

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      <div className="flex h-16 items-center justify-center border-b">
        <h1 className="text-xl font-bold text-primary">Mitsume</h1>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/query' && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.key}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.key)}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('nav.admin')}
              </p>
            </div>
            {adminNavigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.key)}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 truncate">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={t('nav.logout')}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
