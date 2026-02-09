import { api } from '@/lib/api-client'
import type { ApiTheme, ApiThemeDetail } from '@/types'

export function fetchThemes(): Promise<ApiTheme[]> {
  return api.get<ApiTheme[]>('/themes')
}

export function fetchThemeDetail(id: string): Promise<ApiThemeDetail> {
  return api.get<ApiThemeDetail>(`/themes/${id}`)
}
