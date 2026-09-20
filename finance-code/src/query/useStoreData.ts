import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllData } from '@/storage/repository'

export const STORE_DATA_KEY = ['store-data'] as const

export function useStoreData(enabled = true) {
  return useQuery({
    queryKey: STORE_DATA_KEY,
    queryFn: getAllData,
    enabled,
  })
}

export function useInvalidateStoreData() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: STORE_DATA_KEY })
}
