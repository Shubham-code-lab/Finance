import { describe, expect, it } from 'vitest'
import { backupToCloudRecords, cloudRecordsToBackup } from '@/firebase/cloudBackup'
import { BackupFile } from '@/domain/types'

describe('cloud backup conversion', () => {
  it('round trips keyed IndexedDB records', () => {
    const backup: BackupFile = {
      app: 'finance-local',
      formatVersion: 1,
      exportedAt: '2026-09-12T00:00:00.000Z',
      stores: {
        meta: [{ key: 'seeded', value: true }],
        accounts: [{ id: 'bank', name: 'Bank' }],
        columnMappings: [{ tableId: 'table-1', kind: 'unmapped', roles: {} }],
        dashboard: [{ widgets: [] }],
      },
    }

    const records = backupToCloudRecords(backup)
    const restored = cloudRecordsToBackup(records, backup.exportedAt)

    expect(restored.stores.meta).toEqual(backup.stores.meta)
    expect(restored.stores.accounts).toEqual(backup.stores.accounts)
    expect(restored.stores.columnMappings).toEqual(backup.stores.columnMappings)
    expect(restored.stores.dashboard).toEqual(backup.stores.dashboard)
  })
})
