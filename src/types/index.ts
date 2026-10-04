export type ReviewCategory = 'design-change' | 'render-error' | 'environment-noise'
export type RunStatus = 'pending' | 'approved' | 'rejected' | 'merged'
export type Severity = 'high' | 'medium' | 'low'

export interface Project {
  id: string
  name: string
  code: string
  owner: string
  pageCount: number
}

export interface DifferenceRegion {
  id: string
  x: number
  y: number
  width: number
  height: number
  severity: Severity
  pixels: number
  kind: 'layout' | 'content' | 'color' | 'environment'
  ignored: boolean
  ruleId?: string
}

export interface ReviewRecord {
  category: ReviewCategory
  decision: 'approved' | 'rejected'
  reviewer: string
  reason: string
  reviewedAt: string
  /** 审批时核对通过的忽略规则版本 */
  rulesVersion: number
  /** 审批时核对通过的当前有效基线 */
  baselineId?: string
  baselineVersion: string
}

export interface ReviewConflict {
  reviewer: string
  decision: 'approved' | 'rejected'
  reason: string
  /** 冲突说明：为什么这次提交没有生效 */
  conflict: string
  attemptedAt: string
}

export interface ScreenshotRun {
  id: string
  name: string
  projectId: string
  page: string
  device: string
  theme: 'light' | 'dark'
  build: string
  status: RunStatus
  mismatchRate: number
  capturedAt: string
  baselineVersion: string
  currentVersion: string
  baselineImage?: string
  currentImage?: string
  regions: DifferenceRegion[]
  review?: ReviewRecord
  mergedRunIds?: string[]
  /** 差异证据计算时使用的忽略规则版本 */
  rulesVersion: number
  /** 差异对照使用的基线记录 */
  baselineId?: string
  /** 规则变更后证据被重算的时间与原因 */
  recomputedAt?: string
  recomputeReason?: string
  /** 并发审批被拒绝时留下的冲突说明 */
  conflicts?: ReviewConflict[]
}

export interface ReleaseBatch {
  id: string
  name: string
  projectId: string
  build: string
  locked: boolean
  lockedBy?: string
  lockedAt?: string
  /** 锁定时快照的忽略规则版本，锁定批次继续按原证据审批 */
  lockedRulesVersion?: number
}

export interface Baseline {
  id: string
  projectId: string
  page: string
  device: string
  theme: 'light' | 'dark'
  version: string
  approvedBy: string
  reason: string
  approvedAt: string
  runId: string
  active: boolean
}

export interface IgnoreRule {
  id: string
  name: string
  projectId: string
  selector: string
  pagePattern: string
  devicePattern: string
  maxDelta: number
  enabled: boolean
  createdAt: string
}

export interface DashboardData {
  pendingReview: number
  approvedToday: number
  highRisk: number
  activeBaselines: number
  trend: Array<{ date: string; total: number; failed: number }>
}

export interface RunFilters {
  projectId?: string
  page?: string
  device?: string
  theme?: string
  build?: string
  status?: string
  keyword?: string
}

export interface ReviewPayload {
  category: ReviewCategory
  decision: 'approved' | 'rejected'
  reviewer: string
  reason: string
  /** 提交人打开页面时看到的忽略规则版本，用于并发核对 */
  expectedRulesVersion: number
  /** 提交人打开页面时看到的当前有效基线，null 表示当时没有有效基线 */
  expectedBaselineId: string | null
}

export interface ImportRunPayload {
  projectId: string
  page: string
  device: string
  theme: 'light' | 'dark'
  build: string
  baselineVersion: string
  currentVersion: string
  files: Array<{ name: string; size: number; dataUrl: string }>
  baselineImage?: string
}
