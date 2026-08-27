import { AppDataProvider } from '@/app/AppDataContext'
import { HelpCenterProvider } from '@/components/help/HelpCenterContext'
import { AppShell } from '@/components/layout/AppShell'

export function ProtectedLayout() {
  return <AppDataProvider><HelpCenterProvider><AppShell /></HelpCenterProvider></AppDataProvider>
}
