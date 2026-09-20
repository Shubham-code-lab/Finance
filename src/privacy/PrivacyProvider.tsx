import { PropsWithChildren, useMemo, useState } from 'react'
import { PrivacyContext } from '@/privacy/privacy'

export function PrivacyProvider({ children }: PropsWithChildren) {
  const [masked, setMasked] = useState(true)
  const value = useMemo(() => ({ masked, toggle: () => setMasked((current) => !current) }), [masked])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}
