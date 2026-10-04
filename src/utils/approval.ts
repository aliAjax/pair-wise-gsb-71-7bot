import type { ApprovalConflict, ReviewRecord, ReviewRole, RunStatus } from '@/types'

export const roleLabel = (role: ReviewRole): string =>
  role === 'release-manager' ? '发布负责人' : '评审人'

export const decisionLabel = (decision: ReviewRecord['decision']): string =>
  decision === 'approved' ? '已批准' : '已驳回'

export const categoryLabel = (category: ReviewRecord['category']): string =>
  category === 'design-change'
    ? '设计变更'
    : category === 'render-error'
      ? '渲染异常'
      : '环境噪声'

/** 所有页面共用的审批结论文案，避免列表/详情/导出口径不一致 */
export const approvalSummary = (review?: ReviewRecord): string => {
  if (!review) return '尚未审批'
  return `${decisionLabel(review.decision)} · ${review.reviewer}（${roleLabel(review.role)}）· 规则 v${review.rulesVersion} · 基线 ${review.baselineVersion}`
}

export const conflictKindLabel = (kind: ApprovalConflict['kind']): string => {
  switch (kind) {
    case 'concurrent-approval':
      return '并发审批冲突'
    case 'stale-baseline':
      return '基线版本落后'
    case 'stale-rules':
      return '规则版本失效'
  }
}

export const statusLabel = (status: RunStatus): string => {
  switch (status) {
    case 'pending':
      return '待审批'
    case 'approved':
      return '已批准'
    case 'rejected':
      return '已驳回'
    case 'merged':
      return '已合并'
    case 'stale':
      return '规则失效待重算'
  }
}

export const formatTime = (value: string): string => value.slice(0, 16).replace('T', ' ')
