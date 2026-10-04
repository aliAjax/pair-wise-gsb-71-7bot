import type { ScreenshotRun } from '@/types'

/**
 * 审批结果与依据的统一文案，回归运行列表、详情、结果导出和概览共用，
 * 保证四个视图展示同一份审批结论与核对依据。
 */
export const reviewBasisText = (run: ScreenshotRun): string => {
  if (!run.review) return ''
  const { reviewer, baselineVersion, rulesVersion } = run.review
  return `${reviewer} · 依据基线 ${baselineVersion} · 规则 v${rulesVersion}`
}

export const decisionText = (run: ScreenshotRun): string => {
  if (!run.review) return '尚未审批'
  return run.review.decision === 'approved' ? '已批准' : '已驳回'
}
