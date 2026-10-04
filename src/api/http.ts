import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { readDb, writeDb } from '@/mocks/db'
import type {
  ApprovalConflict,
  Baseline,
  DashboardData,
  IgnoreRule,
  ImportRunPayload,
  LockBatchPayload,
  Project,
  ReleaseBatch,
  ReviewPayload,
  RuleMeta,
  RunFilters,
  ScreenshotRun,
} from '@/types'

export const api = axios.create({
  baseURL: '/mock-api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

const statusText = (status: number) =>
  status === 200 ? 'OK' : status === 201 ? 'Created' : status === 409 ? 'Conflict' : 'OK'

const respond = <T>(config: InternalAxiosRequestConfig, data: T, status = 200) => ({
  data,
  status,
  statusText: statusText(status),
  headers: {},
  config,
})

const parseBody = <T>(config: InternalAxiosRequestConfig): T => {
  if (typeof config.data === 'string') return JSON.parse(config.data) as T
  return config.data as T
}

export interface ReviewResult {
  run: ScreenshotRun
  conflict?: ApprovalConflict
}

type BaselineKey = Pick<ScreenshotRun, 'projectId' | 'page' | 'device' | 'theme'>

const activeBaselineFor = (db: ReturnType<typeof readDb>, key: BaselineKey): Baseline | undefined =>
  db.baselines.find(
    (item) =>
      item.projectId === key.projectId &&
      item.page === key.page &&
      item.device === key.device &&
      item.theme === key.theme &&
      item.active,
  )

/** 依据当前启用的忽略规则重算差异区域与差异率 */
const recomputeRegions = (run: ScreenshotRun, rules: IgnoreRule[]) => {
  const environmentRulesEnabled = rules.some((rule) => rule.enabled && rule.id === 'rule-time')
  const regions = run.regions.map((region) =>
    region.kind === 'environment'
      ? { ...region, ignored: environmentRulesEnabled, ruleId: environmentRulesEnabled ? 'rule-time' : undefined }
      : { ...region },
  )
  const totalPixels = regions.reduce((sum, region) => sum + region.pixels, 0) || 1
  const suspiciousPixels = regions.filter((region) => !region.ignored).reduce((sum, region) => sum + region.pixels, 0)
  const mismatchRate = Number(((suspiciousPixels / totalPixels) * run.mismatchRate + 0.32).toFixed(2))
  return { regions, mismatchRate }
}

/**
 * 规则集发生变化：版本号 +1，所有未决（待审批/已失效）运行按新版本标记失效。
 * 已批准、已驳回以及已锁定到发布批次的运行不受影响，继续沿用原证据。
 */
const bumpRulesVersion = (
  db: ReturnType<typeof readDb>,
  summary: string,
  changedBy = '当前评审人',
): RuleMeta => {
  const previous = db.meta.rulesVersion
  const next: RuleMeta = {
    rulesVersion: previous + 1,
    updatedAt: new Date().toISOString(),
    changedBy,
    changeSummary: summary,
  }
  db.meta = next
  db.runs.forEach((run) => {
    if (run.lockedBatchId) return
    if (run.status === 'pending' || run.status === 'stale') {
      run.status = 'stale'
      run.rulesVersion = run.rulesVersion ?? previous
      run.staleReason = `忽略规则集已从 v${run.rulesVersion} 升级到 v${next.rulesVersion}（${summary}），原差异结果失效，请重新计算后再审批。`
    }
  })
  return next
}

const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
  const db = readDb()
  const method = (config.method ?? 'get').toLowerCase()
  const path = config.url ?? ''

  if (method === 'get' && path === '/projects') {
    return respond<Project[]>(config, db.projects)
  }

  if (method === 'get' && path === '/meta') {
    return respond<RuleMeta>(config, db.meta)
  }

  if (method === 'get' && path === '/dashboard') {
    const today = new Date().toISOString().slice(0, 10)
    const dashboard: DashboardData = {
      pendingReview: db.runs.filter((run) => run.status === 'pending').length,
      approvedToday: db.runs.filter(
        (run) => run.review?.decision === 'approved' && run.review.reviewedAt.slice(0, 10) === today,
      ).length,
      highRisk: db.runs.filter((run) => run.mismatchRate >= 5 && run.status !== 'merged').length,
      activeBaselines: db.baselines.filter((baseline) => baseline.active).length,
      staleRuns: db.runs.filter((run) => run.status === 'stale').length,
      openConflicts: db.runs.filter((run) => Boolean(run.conflict) && !run.lockedBatchId).length,
      lockedBatches: db.batches.filter((batch) => batch.freeze).length,
      trend: [
        { date: '09-28', total: 41, failed: 8 },
        { date: '09-29', total: 36, failed: 7 },
        { date: '09-30', total: 33, failed: 5 },
        { date: '10-01', total: 28, failed: 4 },
        { date: '10-02', total: 44, failed: 9 },
        { date: '10-03', total: 47, failed: 6 },
        { date: '10-04', total: 31, failed: 7 },
      ],
    }
    return respond(config, dashboard)
  }

  if (method === 'get' && path === '/runs') {
    const filters = (config.params ?? {}) as RunFilters
    const keyword = filters.keyword?.trim().toLowerCase()
    const data = db.runs.filter((run) => {
      return (
        (!filters.projectId || run.projectId === filters.projectId) &&
        (!filters.page || run.page === filters.page) &&
        (!filters.device || run.device === filters.device) &&
        (!filters.theme || run.theme === filters.theme) &&
        (!filters.build || run.build === filters.build) &&
        (!filters.status || run.status === filters.status) &&
        (!keyword ||
          run.name.toLowerCase().includes(keyword) ||
          run.page.toLowerCase().includes(keyword) ||
          run.id.toLowerCase().includes(keyword))
      )
    })
    return respond(config, data)
  }

  const runMatch = path.match(/^\/runs\/([^/]+)$/)
  if (method === 'get' && runMatch) {
    const run = db.runs.find((item) => item.id === runMatch[1])
    if (!run) throw new Error('运行记录不存在')
    return respond(config, run)
  }

  const reviewMatch = path.match(/^\/runs\/([^/]+)\/review$/)
  if (method === 'patch' && reviewMatch) {
    const payload = parseBody<ReviewPayload>(config)
    const run = db.runs.find((item) => item.id === reviewMatch[1])
    if (!run) throw new Error('运行记录不存在')
    if (!payload.reviewer?.trim() || !payload.reason?.trim()) {
      throw new Error('审批人和审批原因不能为空')
    }
    const now = new Date().toISOString()
    const roleLabel = payload.role === 'release-manager' ? '发布负责人' : '评审人'

    const rejectWithConflict = (conflict: Omit<ApprovalConflict, 'conflictAt' | 'reviewer' | 'role'>) => {
      run.conflict = { ...conflict, reviewer: payload.reviewer, role: payload.role, conflictAt: now }
      if (conflict.kind === 'stale-rules' && (run.status === 'pending' || run.status === 'stale')) {
        run.status = 'stale'
      }
      writeDb(db)
      return respond<ReviewResult>(config, { run, conflict: run.conflict }, 409)
    }

    // 冻结期内已锁定到发布批次的运行不能再被审批，批次继续使用原证据
    if (run.lockedBatchId) {
      throw new Error(`运行已锁定在发布批次 ${run.lockedBatchId}，冻结期内沿用原证据，不能重复审批`)
    }

    // 两个窗口同时提交同一条运行：后落地的一方只看到冲突说明，不能盖掉既有结论
    if (run.review || run.status === 'approved' || run.status === 'rejected') {
      return rejectWithConflict({
        kind: 'concurrent-approval',
        message: `该运行已由${run.review?.role === 'release-manager' ? '发布负责人' : '评审人'} ${
          run.review?.reviewer ?? '另一方'
        }于同一冻结期窗口完成审批，本次提交未覆盖任何结论与基线。`,
        rivalReviewer: run.review?.reviewer,
        rivalRole: run.review?.role,
        rivalReviewedAt: run.review?.reviewedAt,
        runRulesVersion: run.rulesVersion,
        currentRulesVersion: db.meta.rulesVersion,
      })
    }

    // 核对忽略规则版本：运行必须基于当前规则集计算，窗口看到的版本也必须是最新
    const rulesBehind =
      (run.rulesVersion ?? 0) < db.meta.rulesVersion || payload.expectedRulesVersion < db.meta.rulesVersion
    if (rulesBehind) {
      return rejectWithConflict({
        kind: 'stale-rules',
        message: `忽略规则已升级到 v${db.meta.rulesVersion}，本运行/窗口依据 v${Math.min(
          run.rulesVersion ?? payload.expectedRulesVersion,
          payload.expectedRulesVersion,
        )}，审批被拦截，请重新计算运行后再提交。`,
        runRulesVersion: run.rulesVersion ?? payload.expectedRulesVersion,
        currentRulesVersion: db.meta.rulesVersion,
        runBaselineVersion: run.baselineVersion,
        currentBaselineVersion: activeBaselineFor(db, run)?.version,
      })
    }

    // 核对当前有效基线：落后的一方不能盖掉新基线
    const activeBaseline = activeBaselineFor(db, run)
    const currentBaselineVersion = activeBaseline?.version ?? run.baselineVersion
    if (activeBaseline && payload.expectedBaselineVersion !== activeBaseline.version) {
      return rejectWithConflict({
        kind: 'stale-baseline',
        message: `页面「${run.page} · ${run.device}」当前有效基线为 ${activeBaseline.version}，提交依据为 ${payload.expectedBaselineVersion}，落后方不能覆盖新基线，本次仅保留冲突说明。`,
        runBaselineVersion: payload.expectedBaselineVersion,
        currentBaselineVersion: activeBaseline.version,
        runRulesVersion: run.rulesVersion,
        currentRulesVersion: db.meta.rulesVersion,
      })
    }

    // 全部核对通过：固定审批依据（规则版本 + 历史基线），结论与依据一起留痕
    run.status = payload.decision
    run.review = {
      category: payload.category,
      decision: payload.decision,
      reviewer: payload.reviewer,
      role: payload.role,
      reason: payload.reason.trim(),
      reviewedAt: now,
      rulesVersion: db.meta.rulesVersion,
      baselineVersion: currentBaselineVersion,
      baselineId: activeBaseline?.id,
    }

    if (payload.decision === 'approved') {
      // 新增版本而不是覆盖：旧基线停用保留，同时保证同页面设备只有一条有效基线
      if (activeBaseline) activeBaseline.active = false
      const baselineId = `base-${Date.now()}`
      db.baselines.unshift({
        id: baselineId,
        projectId: run.projectId,
        page: run.page,
        device: run.device,
        theme: run.theme,
        version: run.currentVersion,
        approvedBy: `${payload.reviewer}（${roleLabel}）`,
        reason: payload.reason.trim(),
        approvedAt: now,
        runId: run.id,
        active: true,
        rulesVersion: db.meta.rulesVersion,
      })
      run.baselineId = baselineId
      run.baselineVersion = run.currentVersion
      run.review.baselineVersion = run.currentVersion
      run.review.baselineId = baselineId
    }
    // 批准或驳回成立后，此前的冲突说明已被结论取代
    run.conflict = undefined
    writeDb(db)
    return respond<ReviewResult>(config, { run })
  }

  const recomputeMatch = path.match(/^\/runs\/([^/]+)\/recompute$/)
  if (method === 'post' && recomputeMatch) {
    const run = db.runs.find((item) => item.id === recomputeMatch[1])
    if (!run) throw new Error('运行记录不存在')
    if (run.lockedBatchId) throw new Error('运行已锁定在发布批次，冻结期内不需要重新计算')
    const recalculated = recomputeRegions(run, db.rules)
    run.regions = recalculated.regions
    run.mismatchRate = recalculated.mismatchRate
    run.rulesVersion = db.meta.rulesVersion
    run.status = 'pending'
    run.staleReason = undefined
    run.recomputedAt = new Date().toISOString()
    // 重算清掉规则失效类冲突；基线/并发冲突保留，避免掩盖未解决的分歧
    if (run.conflict?.kind === 'stale-rules') run.conflict = undefined
    writeDb(db)
    return respond(config, run, 201)
  }

  if (method === 'post' && path === '/runs/merge') {
    const ids = parseBody<string[]>(config)
    const selected = db.runs.filter((run) => ids.includes(run.id))
    if (selected.length < 2) throw new Error('至少选择两条运行记录进行合并')
    const [first, ...rest] = selected
    if (selected.some((run) => run.lockedBatchId)) {
      throw new Error('选中的运行已锁定在发布批次，不能再合并')
    }
    first.mergedRunIds = selected.map((run) => run.id)
    first.status = 'merged'
    first.mismatchRate =
      selected.reduce((sum, run) => sum + run.mismatchRate, 0) / Math.max(selected.length, 1)
    first.regions = rest.flatMap((run) => run.regions).slice(0, 8)
    writeDb(db)
    return respond(config, first, 201)
  }

  if (method === 'post' && path === '/runs/import') {
    const payload = parseBody<ImportRunPayload>(config)
    if (
      !payload.projectId ||
      !payload.page.trim() ||
      !payload.device.trim() ||
      !payload.build.trim() ||
      payload.files.length === 0
    ) {
      throw new Error('项目、页面、设备、构建版本和截图文件不能为空')
    }
    const activeBaseline = db.baselines.find(
      (item) =>
        item.projectId === payload.projectId &&
        item.page === payload.page.trim() &&
        item.device === payload.device.trim() &&
        item.theme === payload.theme &&
        item.active,
    )
    const imported = payload.files.map((file, index) => {
      const runId = `run-${Date.now()}-${index + 1}`
      const mismatchRate = Number((0.8 + ((file.name.length + index * 3) % 58) / 10).toFixed(2))
      const severity = mismatchRate >= 5 ? 'high' : mismatchRate >= 2 ? 'medium' : 'low'
      const run: ScreenshotRun = {
        id: runId,
        name: `${payload.page} ${payload.device}回归`,
        projectId: payload.projectId,
        page: payload.page.trim(),
        device: payload.device.trim(),
        theme: payload.theme,
        build: payload.build.trim(),
        status: 'pending',
        mismatchRate,
        capturedAt: new Date().toISOString(),
        // 新导入运行直接配对当前有效基线与当前规则版本
        baselineVersion: payload.baselineVersion.trim() || activeBaseline?.version || '未设置基线',
        currentVersion: payload.currentVersion.trim() || payload.build.trim(),
        rulesVersion: db.meta.rulesVersion,
        baselineImage: payload.baselineImage,
        currentImage: file.dataUrl,
        regions: [
          {
            id: `${runId}-r1`,
            x: 12 + index * 3,
            y: 22 + index * 2,
            width: 24,
            height: 14,
            severity,
            pixels: Math.round(file.size / 8 || 620),
            kind: 'layout',
            ignored: false,
          },
          {
            id: `${runId}-r2`,
            x: 58,
            y: 52,
            width: 16,
            height: 10,
            severity: severity === 'high' ? 'medium' : 'low',
            pixels: Math.round(file.size / 18 || 180),
            kind: 'color',
            ignored: false,
          },
        ],
      }
      return run
    })
    db.runs.unshift(...imported)
    writeDb(db)
    return respond(config, imported, 201)
  }

  if (method === 'get' && path === '/baselines') {
    const projectId = config.params?.projectId as string | undefined
    return respond(
      config,
      db.baselines.filter((baseline) => !projectId || baseline.projectId === projectId),
    )
  }

  if (method === 'get' && path === '/rules') {
    return respond<IgnoreRule[]>(config, db.rules)
  }

  if (method === 'post' && path === '/rules') {
    const input = parseBody<Omit<IgnoreRule, 'id' | 'createdAt' | 'version'>>(config)
    const rule: IgnoreRule = {
      ...input,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
      version: db.meta.rulesVersion + 1,
    }
    db.rules.unshift(rule)
    bumpRulesVersion(db, `新增忽略规则「${rule.name}」`)
    writeDb(db)
    return respond(config, rule, 201)
  }

  const ruleMatch = path.match(/^\/rules\/([^/]+)$/)
  if (method === 'patch' && ruleMatch) {
    const payload = parseBody<Partial<IgnoreRule>>(config)
    const rule = db.rules.find((item) => item.id === ruleMatch[1])
    if (!rule) throw new Error('规则不存在')
    Object.assign(rule, payload)
    rule.version = db.meta.rulesVersion + 1
    const summary =
      payload.enabled === undefined
        ? `调整忽略规则「${rule.name}」`
        : `忽略规则「${rule.name}」已${payload.enabled ? '启用' : '停用'}`
    bumpRulesVersion(db, summary)
    writeDb(db)
    return respond(config, rule)
  }
  if (method === 'delete' && ruleMatch) {
    const index = db.rules.findIndex((item) => item.id === ruleMatch[1])
    if (index < 0) throw new Error('规则不存在')
    const [removed] = db.rules.splice(index, 1)
    bumpRulesVersion(db, `删除忽略规则「${removed.name}」`)
    writeDb(db)
    return respond(config, { success: true })
  }

  if (method === 'get' && path === '/batches') {
    return respond<ReleaseBatch[]>(config, db.batches)
  }

  if (method === 'post' && path === '/batches/lock') {
    const payload = parseBody<LockBatchPayload>(config)
    if (!payload.name?.trim() || !payload.build?.trim() || payload.runIds.length === 0) {
      throw new Error('批次名称、构建版本和至少一条运行不能为空')
    }
    const targets = db.runs.filter((run) => payload.runIds.includes(run.id))
    if (targets.length !== payload.runIds.length) throw new Error('部分运行不存在')
    const notReady = targets.find(
      (run) => run.status !== 'approved' || !run.review || !run.baselineId || run.lockedBatchId,
    )
    if (notReady) {
      throw new Error(`运行 ${notReady.id} 未批准、缺少历史基线证据或已锁定，不能进入发布批次`)
    }
    const batch: ReleaseBatch = {
      id: `batch-${Date.now()}`,
      name: payload.name.trim(),
      projectId: targets[0].projectId,
      build: payload.build.trim(),
      lockedAt: new Date().toISOString(),
      lockedBy: payload.lockedBy.trim() || '发布负责人',
      freeze: true,
      runIds: targets.map((run) => run.id),
      evidence: targets.map((run) => ({
        runId: run.id,
        runName: run.name,
        baselineId: run.baselineId as string,
        baselineVersion: run.review?.baselineVersion ?? run.baselineVersion,
        rulesVersion: run.review?.rulesVersion ?? run.rulesVersion ?? db.meta.rulesVersion,
        approvedBy: run.review?.reviewer ?? '',
        approvedAt: run.review?.reviewedAt ?? '',
        reason: run.review?.reason ?? '',
      })),
    }
    targets.forEach((run) => {
      run.lockedBatchId = batch.id
    })
    db.batches.unshift(batch)
    writeDb(db)
    return respond(config, batch, 201)
  }

  throw new Error(`Mock API 未实现：${method.toUpperCase()} ${path}`)
}

api.defaults.adapter = mockAdapter

export const getProjects = async (): Promise<Project[]> => (await api.get<Project[]>('/projects')).data
export const getMeta = async (): Promise<RuleMeta> => (await api.get<RuleMeta>('/meta')).data
export const getDashboard = async (): Promise<DashboardData> =>
  (await api.get<DashboardData>('/dashboard')).data
export const getRuns = async (filters: RunFilters = {}): Promise<ScreenshotRun[]> =>
  (await api.get<ScreenshotRun[]>('/runs', { params: filters })).data
export const getRun = async (id: string): Promise<ScreenshotRun> =>
  (await api.get<ScreenshotRun>(`/runs/${id}`)).data
export const reviewRun = async (id: string, payload: ReviewPayload): Promise<ReviewResult> => {
  try {
    return (await api.patch<ReviewResult>(`/runs/${id}/review`, payload)).data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      return error.response.data as ReviewResult
    }
    throw error
  }
}
export const recomputeRun = async (id: string): Promise<ScreenshotRun> =>
  (await api.post<ScreenshotRun>(`/runs/${id}/recompute`)).data
export const mergeRuns = async (ids: string[]): Promise<ScreenshotRun> =>
  (await api.post<ScreenshotRun>('/runs/merge', ids)).data
export const importRuns = async (payload: ImportRunPayload): Promise<ScreenshotRun[]> =>
  (await api.post<ScreenshotRun[]>('/runs/import', payload)).data
export const getBaselines = async (projectId?: string): Promise<Baseline[]> =>
  (await api.get<Baseline[]>('/baselines', { params: { projectId } })).data
export const getRules = async (): Promise<IgnoreRule[]> =>
  (await api.get<IgnoreRule[]>('/rules')).data
export const createRule = async (
  payload: Omit<IgnoreRule, 'id' | 'createdAt' | 'version'>,
): Promise<IgnoreRule> => (await api.post<IgnoreRule>('/rules', payload)).data
export const toggleRule = async (id: string, enabled: boolean): Promise<IgnoreRule> =>
  (await api.patch<IgnoreRule>(`/rules/${id}`, { enabled })).data
export const deleteRule = async (id: string): Promise<{ success: boolean }> =>
  (await api.delete<{ success: boolean }>(`/rules/${id}`)).data
export const getBatches = async (): Promise<ReleaseBatch[]> =>
  (await api.get<ReleaseBatch[]>('/batches')).data
export const lockBatch = async (payload: LockBatchPayload): Promise<ReleaseBatch> =>
  (await api.post<ReleaseBatch>('/batches/lock', payload)).data
