export type ReviewCategory = 'design-change' | 'render-error' | 'environment-noise'
export type RunStatus = 'pending' | 'approved' | 'rejected' | 'merged' | 'stale'
export type Severity = 'high' | 'medium' | 'low'
export type ReviewRole = 'reviewer' | 'release-manager'

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

/** 并发提交或版本落后时，只在运行上留下冲突说明，不覆盖任何既有结论与基线 */
export interface ApprovalConflict {
  kind: 'concurrent-approval' | 'stale-baseline' | 'stale-rules'
  message: string
  reviewer: string
  role: ReviewRole
  rivalReviewer?: string
  rivalRole?: ReviewRole
  rivalReviewedAt?: string
  runBaselineVersion?: string
  currentBaselineVersion?: string
  runRulesVersion?: number
  currentRulesVersion?: number
  conflictAt: string
}

export interface ReviewRecord {
  category: ReviewCategory
  decision: 'approved' | 'rejected'
  reviewer: string
  role: ReviewRole
  reason: string
  reviewedAt: string
  /** 审批时刻核对并固定下来的依据：忽略规则版本与有效基线 */
  rulesVersion: number
  baselineVersion: string
  baselineId?: string
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
  /** 运行计算差异时所依据的忽略规则版本；落后于当前版本即失效待重算 */
  rulesVersion?: number
  /** 批准后指向作为证据的历史基线 */
  baselineId?: string
  /** 锁定到发布批次后不可再评审，批次继续使用该运行的原证据 */
  lockedBatchId?: string
  /** 规则变化导致的失效说明 */
  staleReason?: string
  recomputedAt?: string
  /** 最近一次冲突说明（结论与基线不变，仅留痕） */
  conflict?: ApprovalConflict
  baselineImage?: string
  currentImage?: string
  regions: DifferenceRegion[]
  review?: ReviewRecord
  mergedRunIds?: string[]
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
  /** 基线被批准时的忽略规则版本，作为证据的一部分 */
  rulesVersion?: number
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
  /** 规则自身的修订版本；规则集整体版本存放在 meta.rulesVersion */
  version?: number
}

/** 忽略规则集整体版本，任何规则增删改都会使版本号 +1 */
export interface RuleMeta {
  rulesVersion: number
  updatedAt: string
  changedBy: string
  changeSummary: string
}

export interface BatchEvidence {
  runId: string
  runName: string
  baselineId: string
  baselineVersion: string
  rulesVersion: number
  approvedBy: string
  approvedAt: string
  reason: string
}

export interface ReleaseBatch {
  id: string
  name: string
  projectId: string
  build: string
  lockedAt: string
  lockedBy: string
  /** 发布冻结期锁定的批次继续使用原证据，不受后续规则变化影响 */
  freeze: boolean
  runIds: string[]
  evidence: BatchEvidence[]
}

export interface DashboardData {
  pendingReview: number
  approvedToday: number
  highRisk: number
  activeBaselines: number
  staleRuns: number
  openConflicts: number
  lockedBatches: number
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
  role: ReviewRole
  reason: string
  /** 提交方窗口中看到的规则版本与有效基线，服务端会再次核对 */
  expectedRulesVersion: number
  expectedBaselineVersion: string
}

export interface LockBatchPayload {
  name: string
  build: string
  lockedBy: string
  runIds: string[]
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
