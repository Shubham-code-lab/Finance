import { createContext, useContext, useEffect } from 'react'

export type PageHeaderAction = { label: string; onClick: () => void }

export const PageHeaderActionContext = createContext<(action: PageHeaderAction | null) => void>(() => {})

export function usePageHeaderAction(label: string, onClick: () => void) {
  const setAction = useContext(PageHeaderActionContext)

  useEffect(() => {
    setAction({ label, onClick })
    return () => setAction(null)
  }, [label, onClick, setAction])
}
