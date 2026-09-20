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
  return snapshot.exists() ? normalizeStockListState(snapshot.data()) : null
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
