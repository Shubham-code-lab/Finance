import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { BackupFile } from '@/domain/types'
import { firestore } from '@/firebase/client'
import { STORE_NAMES, StoreName } from '@/storage/stores'

type CloudRecord = {
  store: StoreName
  key: string
  value: unknown
}

const BATCH_LIMIT = 400

function requireFirestore() {
  if (!firestore) throw new Error('Firebase is not configured on this device.')
  return firestore
}

function recordKey(store: StoreName, value: unknown, index: number) {
  if (store === 'meta') return (value as { key?: string }).key
  if (store === 'dashboard') return 'layout'
  const record = value as { id?: string; tableId?: string }
  return record.id ?? record.tableId ?? String(index)
}

function recordId(store: StoreName, key: string) {
  return encodeURIComponent(`${store}:${key}`)
}

export function backupToCloudRecords(backup: BackupFile): CloudRecord[] {
  return STORE_NAMES.flatMap((store) =>
    (backup.stores[store] ?? []).map((value, index) => {
      const key = recordKey(store, value, index)
      if (!key) throw new Error(`A ${store} record has no stable key.`)
      return { store, key, value: JSON.parse(JSON.stringify(value)) as unknown }
    }),
  )
}

export function cloudRecordsToBackup(records: CloudRecord[], exportedAt: string): BackupFile {
  const stores = Object.fromEntries(STORE_NAMES.map((store) => [store, []])) as Record<string, unknown[]>
  records.forEach((record) => stores[record.store].push(record.value))
  return { app: 'finance-local', formatVersion: 1, exportedAt, stores }
}

async function commitInChunks(operations: ((batch: ReturnType<typeof writeBatch>) => void)[]) {
  const db = requireFirestore()
  for (let start = 0; start < operations.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    operations.slice(start, start + BATCH_LIMIT).forEach((operation) => operation(batch))
    await batch.commit()
  }
}

export async function uploadBackup(uid: string, backup: BackupFile) {
  const db = requireFirestore()
  const recordsRef = collection(db, 'users', uid, 'cloudRecords')
  const existing = await getDocs(recordsRef)
  const records = backupToCloudRecords(backup)
  const desiredIds = new Set(records.map((record) => recordId(record.store, record.key)))

  await commitInChunks(
    records.map((record) => (batch) => {
      batch.set(doc(recordsRef, recordId(record.store, record.key)), record)
    }),
  )

  await commitInChunks(
    existing.docs.filter((snapshot) => !desiredIds.has(snapshot.id)).map((snapshot) => (batch) => batch.delete(snapshot.ref)),
  )

  await writeBatch(db)
    .set(doc(db, 'users', uid, 'cloudSync', 'state'), {
      app: backup.app,
      formatVersion: backup.formatVersion,
      exportedAt: backup.exportedAt,
      recordCount: records.length,
      uploadedAt: new Date().toISOString(),
    })
    .commit()

  return records.length
}

export async function downloadBackup(uid: string) {
  const db = requireFirestore()
  const state = await getDoc(doc(db, 'users', uid, 'cloudSync', 'state'))
  if (!state.exists()) throw new Error('No cloud backup exists for this account.')
  const metadata = state.data() as { app?: string; formatVersion?: number; exportedAt?: string }
  if (metadata.app !== 'finance-local' || metadata.formatVersion !== 1 || !metadata.exportedAt) {
    throw new Error('The cloud backup format is not supported.')
  }

  const snapshot = await getDocs(collection(db, 'users', uid, 'cloudRecords'))
  const records = snapshot.docs.map((item) => item.data() as CloudRecord)
  return cloudRecordsToBackup(records, metadata.exportedAt)
}
