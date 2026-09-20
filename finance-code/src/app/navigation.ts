import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import BackupTableIcon from '@mui/icons-material/BackupTable'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import PaidIcon from '@mui/icons-material/Paid'
import PieChartIcon from '@mui/icons-material/PieChart'
import ShowChartIcon from '@mui/icons-material/ShowChart'

export type View = 'dashboard' | 'accounts' | 'income' | 'investments' | 'stocks' | 'tables' | 'charts' | 'import'
export type NavTone = 'navIconBlue' | 'navIconGreen' | 'navIconGold' | 'navIconRose' | 'navIconRed'

export const navItems: { id: View; icon: typeof DashboardIcon; label: string; tone: NavTone }[] = [
  { id: 'dashboard', icon: DashboardIcon, label: 'dashboard', tone: 'navIconGold' },
  { id: 'accounts', icon: AccountBalanceIcon, label: 'accounts', tone: 'navIconBlue' },
  { id: 'income', icon: PaidIcon, label: 'income', tone: 'navIconGreen' },
  { id: 'investments', icon: AccountBalanceWalletIcon, label: 'my investments', tone: 'navIconGold' },
  { id: 'stocks', icon: ShowChartIcon, label: 'stocks', tone: 'navIconRose' },
  { id: 'tables', icon: BackupTableIcon, label: 'tables', tone: 'navIconBlue' },
  { id: 'charts', icon: PieChartIcon, label: 'charts', tone: 'navIconRose' },
  { id: 'import', icon: FileUploadIcon, label: 'upload', tone: 'navIconRed' },
]

export const validViews = new Set<View>(navItems.map((item) => item.id))

export function viewFromHash(): View {
  const route = window.location.hash.replace(/^#\/?/, '')
  if (route === 'mutual-funds') return 'investments'
  const candidate = route as View
  return validViews.has(candidate) ? candidate : 'dashboard'
}
