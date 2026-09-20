import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, firestore } from '@/firebase/client'
import { KeyedStoreName, STORE_NAMES, StoreName } from '@/storage/stores'

const VERSION = 1
const MARKER_ID = 'bundled-storage-v1'
const BATCH_LIMIT = 400
const MAX_BUNDLE_BYTES = 850_000
const MIGRATION_LEASE_MS = 5 * 60_000
const FIRESTORE_READ_TIMEOUT_MS = 60_000

type BundleDocument = { store: StoreName; bucket: string; records: unknown[] }
type MigrationMarker = {
  version: number
  status: 'migrating' | 'complete' | 'failed'
  owner?: string
  leaseUntil?: number
  completedStores?: StoreName[]
  bundleCount?: number
  revision?: string
  error?: string
  startedAt?: string
  heartbeatAt?: string
}

const stores = new Map<StoreName, unknown[]>()
const bundleDocuments = new Map<string, BundleDocument>()
const locks = new Map<StoreName, Promise<void>>()
let activeUid = ''
let initialization: Promise<void> | null = null
let forceServer = false

function withTimeout<T>(promise: Promise<T>, message: string, milliseconds = 30_000) {
  return Promise.race([promise, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(message)), milliseconds))])
}

function context() {
  const user = auth?.currentUser
  if (!firestore || !user) throw new Error('Sign in with Google to access your finance data.')
  if (activeUid !== user.uid) {
    activeUid = user.uid
    stores.clear()
    bundleDocuments.clear()
    locks.clear()
    initialization = null
    forceServer = false
  }
  return { db: firestore, uid: user.uid }
}

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function valueKey(store: StoreName, value: unknown, index = 0) {
  if (store === 'meta') return String((value as { key?: string }).key ?? index)
  if (store === 'dashboard') return 'layout'
  const record = value as { id?: string; tableId?: string }
  return String(record.id ?? record.tableId ?? index)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function recordDate(value: unknown) {
  const record = value as { date?: unknown; month?: unknown; importedAt?: unknown; cells?: Record<string, unknown> }
  const candidate = String(record.date ?? record.month ?? record.importedAt ?? record.cells?.date ?? '')
  return /^\d{4}-\d{2}/.test(candidate) ? candidate.slice(0, 7) : ''
}

function bucketFor(store: StoreName, value: unknown, index: number) {
  const record = value as { tableId?: string }
  const month = recordDate(value)
  if (store === 'transactions' || store === 'snapshots')
    return `${store}:${month || 'undated'}:${stableHash(valueKey(store, value, index)) % 2}`
  if (store === 'customTableRows')
    return `${store}:${record.tableId ?? 'unknown'}:${month || `legacy-${stableHash(valueKey(store, value, index)) % 8}`}`
  if (store === 'sipEvents' || store === 'imports') return `${store}:${month.slice(0, 4) || 'undated'}`
  return store
}

function bundleId(bucket: string) {
  return encodeURIComponent(bucket)
}

function groupedDocuments(store: StoreName, values: unknown[]) {
  const grouped = new Map<string, unknown[]>()
  values.forEach((value, index) => {
    const bucket = bucketFor(store, value, index)
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), clean(value)])
  })
  return new Map(
    [...grouped.entries()].map(([bucket, records]) => {
      const document: BundleDocument = { store, bucket, records }
      if (new Blob([JSON.stringify(document)]).size > MAX_BUNDLE_BYTES) {
        throw new Error(`The ${bucket} bundle is too large. Split this import into a smaller date range.`)
      }
      return [bundleId(bucket), document]
    }),
  )
}

export function bundlePlan(store: StoreName, values: unknown[]) {
  const documents = groupedDocuments(store, values)
  return [...documents.values()].map((document) => ({
    bucket: document.bucket,
    records: document.records.length,
    bytes: new Blob([JSON.stringify(document)]).size,
  }))
}

function bundleCollection() {
  const { db, uid } = context()
  return collection(db, 'users', uid, 'dataBundles')
}

function activeBundleQuery() {
  return query(bundleCollection(), where('store', '!=', 'priceQuotes'))
}

function markerRef() {
  const { db, uid } = context()
  return doc(db, 'users', uid, 'system', MARKER_ID)
}

function hydrate(documents: BundleDocument[]) {
  stores.clear()
  bundleDocuments.clear()
  STORE_NAMES.forEach((store) => stores.set(store, []))
  documents.forEach((document) => {
    if (!STORE_NAMES.includes(document.store)) return
    bundleDocuments.set(bundleId(document.bucket), document)
    stores.set(document.store, [...(stores.get(document.store) ?? []), ...document.records])
  })
}

async function commitOperations(operations: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  const { db } = context()
  for (let start = 0; start < operations.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    operations.slice(start, start + BATCH_LIMIT).forEach((operation) => operation(batch))
    await withTimeout(
      batch.commit(),
      'Firebase did not confirm the storage update within 30 seconds. Check your connection or daily quota, then retry.',
    )
  }
}

async function updateMarker() {
  await withTimeout(
    setDoc(
      markerRef(),
      {
        version: VERSION,
        status: 'complete',
        bundleCount: bundleDocuments.size,
        revision: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    ),
    'Firebase did not confirm the cache revision within 30 seconds.',
  )
}

async function persistStore(store: StoreName, updateRevision = true) {
  const desired = groupedDocuments(store, stores.get(store) ?? [])
  const existing = new Map([...bundleDocuments.entries()].filter(([, document]) => document.store === store))
  const ref = bundleCollection()
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = []

  desired.forEach((document, id) => {
    if (JSON.stringify(existing.get(id)) !== JSON.stringify(document)) operations.push((batch) => batch.set(doc(ref, id), document))
  })
  existing.forEach((_document, id) => {
    if (!desired.has(id)) operations.push((batch) => batch.delete(doc(ref, id)))
  })
  if (!operations.length) return 0
  await commitOperations(operations)
  existing.forEach((_document, id) => bundleDocuments.delete(id))
  desired.forEach((document, id) => bundleDocuments.set(id, document))
  if (updateRevision) await updateMarker()
  return operations.length
}

async function legacyStore(store: StoreName) {
  const { db, uid } = context()
  const snapshot = await withTimeout(
    getDocsFromServer(collection(db, 'users', uid, store)),
    `Firebase did not return the ${store} migration data within 60 seconds. Check your connection or daily quota, then retry.`,
    FIRESTORE_READ_TIMEOUT_MS,
  )
  return snapshot.docs.map((item) => (store === 'meta' ? { key: decodeURIComponent(item.id), value: item.data().value } : item.data()))
}

async function claimMigration(marker: MigrationMarker | null) {
  const owner = crypto.randomUUID()
  const now = Date.now()
  const claimed = await runTransaction(context().db, async (transaction) => {
    const reference = markerRef()
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists() ? (snapshot.data() as MigrationMarker) : marker
    if (current?.status === 'complete' && current.version === VERSION) return 'complete' as const
    if (current?.status === 'migrating' && (current.leaseUntil ?? 0) > now && current.owner !== owner) {
      return 'wait' as const
    }
    transaction.set(
      reference,
      {
        version: VERSION,
        status: 'migrating',
        owner,
        leaseUntil: now + MIGRATION_LEASE_MS,
        completedStores: current?.completedStores ?? [],
        startedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    return 'claimed' as const
  })
  return { state: claimed, owner }
}

async function migrate(marker: MigrationMarker | null) {
  const { state, owner } = await claimMigration(marker)
  if (state === 'complete') {
    const snapshot = await getDocs(activeBundleQuery())
    hydrate(snapshot.docs.map((item) => item.data() as BundleDocument))
    return
  }
  if (state === 'wait') {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      const snapshot = await getDoc(markerRef())
      const latest = snapshot.exists() ? (snapshot.data() as MigrationMarker) : null
      if (latest?.status === 'complete' && latest.version === VERSION) {
        const bundles = await getDocs(activeBundleQuery())
        hydrate(bundles.docs.map((item) => item.data() as BundleDocument))
        return
      }
      if (!latest || latest.status === 'failed' || (latest.leaseUntil ?? 0) <= Date.now()) {
        await migrate(latest)
        return
      }
    }
    throw new Error('The storage migration is still running in another tab. Keep one Finance tab open and try again shortly.')
  }
  const completed = new Set(marker?.completedStores ?? [])
  try {
    const partial = await getDocs(activeBundleQuery())
    hydrate(partial.docs.map((item) => item.data() as BundleDocument))
    const pendingStores = STORE_NAMES.filter((store) => !completed.has(store))
    for (const store of pendingStores) {
      stores.set(store, await legacyStore(store))
      await persistStore(store, false)
      completed.add(store)
      await withTimeout(
        setDoc(
          markerRef(),
          {
            version: VERSION,
            status: 'migrating',
            owner,
            leaseUntil: Date.now() + MIGRATION_LEASE_MS,
            heartbeatAt: new Date().toISOString(),
            completedStores: arrayUnion(store),
          },
          { merge: true },
        ),
        'Firebase did not confirm a migration checkpoint within 30 seconds.',
      )
    }
    await withTimeout(
      setDoc(
        markerRef(),
        {
          version: VERSION,
          status: 'complete',
          owner,
          leaseUntil: 0,
          completedStores: [...completed],
          bundleCount: bundleDocuments.size,
          revision: crypto.randomUUID(),
          completedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
      'Firebase did not confirm migration completion within 30 seconds.',
    )
  } catch (cause) {
    await withTimeout(
      setDoc(
        markerRef(),
        {
          version: VERSION,
          status: 'failed',
          owner,
          leaseUntil: 0,
          completedStores: [...completed],
          error: cause instanceof Error ? cause.message.slice(0, 300) : 'Migration failed',
        },
        { merge: true },
      ),
      'Firebase did not confirm the failed migration state within 30 seconds.',
    ).catch(() => undefined)
    throw cause
  }
}

async function initialize() {
  const cachedMarker = forceServer ? null : await getDocFromCache(markerRef()).catch(() => null)
  const serverMarkerSnapshot = await getDoc(markerRef())
  const marker = serverMarkerSnapshot.exists() ? (serverMarkerSnapshot.data() as MigrationMarker) : null
  if (marker?.status !== 'complete' || marker.version !== VERSION) {
    await migrate(marker)
    return
  }

  const cachedRevision = cachedMarker?.exists() ? (cachedMarker.data() as MigrationMarker).revision : null
  const useCache = !forceServer && cachedRevision && cachedRevision === marker.revision
  const snapshot = useCache ? await getDocsFromCache(activeBundleQuery()) : await getDocs(activeBundleQuery())
  hydrate(snapshot.docs.map((item) => item.data() as BundleDocument))
  forceServer = false
}

export async function initializeBundleStore() {
  context()
  initialization ??= initialize().catch((cause) => {
    initialization = null
    throw cause
  })
  return initialization
}

export function requestBundleServerRefresh() {
  forceServer = true
  initialization = null
  stores.clear()
  bundleDocuments.clear()
}

export async function readBundledStore<T>(store: StoreName): Promise<T[]> {
  await initializeBundleStore()
  return structuredClone(stores.get(store) ?? []) as T[]
}

function withStoreLock(store: StoreName, operation: () => Promise<void>) {
  const previous = locks.get(store) ?? Promise.resolve()
  const next = previous.then(operation, operation)
  locks.set(store, next)
  return next.finally(() => {
    if (locks.get(store) === next) locks.delete(store)
  })
}

export async function putBundledValues<T>(store: KeyedStoreName, values: T[]) {
  await initializeBundleStore()
  let writes = 0
  await withStoreLock(store, async () => {
    const current = stores.get(store) ?? []
    const merged = new Map(current.map((value, index) => [valueKey(store, value, index), value]))
    values.forEach((value, index) => merged.set(valueKey(store, value, index), clean(value)))
    stores.set(store, [...merged.values()])
    writes = await persistStore(store)
  })
  return writes
}

export async function replaceBundledWhere<T>(store: KeyedStoreName, predicate: (value: T) => boolean, replacements: T[]) {
  await initializeBundleStore()
  await withStoreLock(store, async () => {
    const current = (stores.get(store) ?? []) as T[]
    stores.set(store, [...current.filter((value) => !predicate(value)), ...clean(replacements)])
    await persistStore(store)
  })
}

export async function deleteBundledWhere<T>(store: KeyedStoreName, predicate: (value: T) => boolean) {
  return replaceBundledWhere(store, predicate, [])
}

export async function replaceBundledStore(store: StoreName, values: unknown[]) {
  await initializeBundleStore()
  await withStoreLock(store, async () => {
    stores.set(store, clean(values))
    await persistStore(store)
  })
}

export async function putBundledDashboard(value: unknown) {
  await replaceBundledStore('dashboard', [value])
}
