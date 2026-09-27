import { doc, getDoc, setDoc } from 'firebase/firestore'
import { normalizeStockListState, StockListState } from '@/domain/stockLists'
import { auth, firestore } from '@/firebase/client'

type StockListDocument = StockListState & { version: 1; updatedAt: string }
let pendingWrite: Promise<boolean> = Promise.resolve(true)

function reference() {
  const user = auth?.currentUser
  return firestore && user ? doc(firestore, 'users', user.uid, 'settings', 'stock-lists') : null
}

export function stockListsOwnerKey() {
  return auth?.currentUser?.uid ?? 'signed-out'
}

export async function readStockLists(): Promise<StockListState | null> {
  const target = reference()
  if (!target) return null
  const snapshot = await getDoc(target)
  if (!snapshot.exists()) return null
  const raw = snapshot.data()
  const normalized = normalizeStockListState(raw)
  if ('currentStocks' in raw) {
    const cleaned: StockListDocument = { version: 1, ...normalized, updatedAt: new Date().toISOString() }
    await setDoc(target, cleaned)
  }
  return normalized
}

export function writeStockLists(value: StockListState) {
  const target = reference()
  if (!target) return Promise.resolve(false)
  const normalized = normalizeStockListState(value)
  const document: StockListDocument = { version: 1, ...normalized, updatedAt: new Date().toISOString() }
  const operation = async () => {
    await setDoc(target, document)
    return true
  }
  pendingWrite = pendingWrite.then(operation, operation)
  return pendingWrite
}
