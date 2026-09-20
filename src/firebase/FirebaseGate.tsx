import { ReactNode, useEffect, useState } from 'react'
import { Login } from '@mui/icons-material'
import { FirebaseError } from 'firebase/app'
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup } from 'firebase/auth'
import { createUseStyles } from 'react-jss'
import { Button } from '@/components/ui'
import { auth, firebaseConfigured } from '@/firebase/client'
import { tokens } from '@/theme/tokens'

const useStyles = createUseStyles({
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: tokens.space.lg,
    background: tokens.color.bgPage,
    color: tokens.color.text,
  },
  content: { display: 'grid', justifyItems: 'center', gap: tokens.space.md, textAlign: 'center' },
  title: { margin: 0, color: tokens.color.accent, fontSize: tokens.font.sizeLg },
  status: { maxWidth: 520, color: tokens.color.textMuted, lineHeight: 1.5 },
})

export function FirebaseGate({ children }: { children: ReactNode }) {
  const classes = useStyles()
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null)
  const [loading, setLoading] = useState(Boolean(auth))
  const [error, setError] = useState('')
  const [marketOnly, setMarketOnly] = useState(() => window.location.hash.replace(/^#\/?/, '') === 'stocks')

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const syncRoute = () => setMarketOnly(window.location.hash.replace(/^#\/?/, '') === 'stocks')
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  if (marketOnly && !user) return children

  const signIn = async () => {
    if (!auth) return
    setError('')
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (reason) {
      const code = reason instanceof FirebaseError ? reason.code : 'auth/unknown'
      const message = reason instanceof Error ? reason.message : 'Google sign-in failed.'
      setError(`${code}: ${message}`)
    }
  }

  if (!firebaseConfigured || !auth) {
    return (
      <div className={classes.page}>
        <div className={classes.content}>
          <h1 className={classes.title}>Finance</h1>
          <div className={classes.status}>Firebase configuration is missing.</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={classes.page}>
        <div className={classes.status}>Checking secure session...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={classes.page}>
        <div className={classes.content}>
          <h1 className={classes.title}>Finance</h1>
          <Button variant="primary" onClick={signIn}>
            <Login fontSize="small" /> Sign in with Google
          </Button>
          {error ? <div className={classes.status}>{error}</div> : null}
        </div>
      </div>
    )
  }

  return children
}
