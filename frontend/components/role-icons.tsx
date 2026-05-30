import type { Role } from '@/lib/types'

interface RoleIconProps {
  role: Role
  className?: string
}

export function RoleIcon({ role, className = 'w-5 h-5' }: RoleIconProps) {
  return <img src={`/opgg_role_icon/${role}.svg`} alt="" className={className} />
}

export const roleNames: Record<Role, string> = {
  TOP: '上单',
  JUN: '打野',
  MID: '中单',
  ADC: '下路',
  SUP: '辅助',
}
