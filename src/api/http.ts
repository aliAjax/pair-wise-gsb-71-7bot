import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { readDb, writeDb, type Database } from '@/mocks/db'
import type {
  Baseline,
  DashboardData,
  IgnoreRule,
  ImportRunPayload,
  Project,
  ReleaseBatch,
  ReviewPayload,
  RunFilters,
  ScreenshotRun,
} from '@/types'

/** 并发审批冲突：提交基于的规则版本或基线已落后，本次不生效但会留下冲突说明 */
export class ReviewConflictError extends Error {
  readonly status = 409

  constructor(message: string) {
    super(message)
    this.name = 'ReviewConflictError'
  }
}

export const api = axios.create({
  baseURL: '/mock-api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

const respond = <T>(config: InternalAxiosRequestConfig, data: T, status = 200) => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Created',
  headers: {},
  config,
})

const parseBody = <T>(config: InternalAxiosRequestConfig): T => {
  if (typeof config.data === 'string') return JSON.parse(config.data) as T
  return config.data as T
}

const findBatchForRun = (db: Database, run: ScreenshotRun): ReleaseBatch | undefined =>
  db.batches.find((batch) => batch.projectId === run.projectId && batch.build === run.build)

const findActiveBaseline = (db: Database, run: ScreenshotRun): Baseline | undefined =>
  db.baselines.find(
    (item) =>
      item.projectId === run.projectId &&
      item.page === run.page &&
      item.device === run.device &&
      item.theme === run.theme &&
      item.active,
  )

const statusLabel = (run: ScreenshotRun): string => {
  if (run.status === 'approved') return '已批准'
  if (run.status === 'rejected') return '已驳回'
  if (run.status === 'merged') return '已合并'
  return '待审批'
}

/**
 * 忽略规则变更后：全局规则版本递增，所有未锁定批次里的待审批运行
 * 按新规则失效重算；已锁定的发布批次继续使用原证据，不受影响。
 */
const recomputePendingRuns = (db: Database): number => {
  let recomputed = 0
  for (const run of db.runs) {
    if (run.status !== 'pending') continue
    if (findBatchForRun(db, run)?.locked) continue
    const pixelsBefore = run.regions
      .filter((region) => !region.ignored)
      .reduce((sum, region) => sum + region.pixels, 0)
    let regionsChanged = false
    for (const region of run.regions) {
      if (!region.ignored || !region.ruleId) continue
      const rule = db.rules.find((item) => item.id === region.ruleId)
      if (!rule || !rule.enabled) {
        region.ignored = false
        delete region.ruleId
        regionsChanged = true
      }
    }
    if (regionsChanged && pixelsBefore > 0) {
      const pixelsAfter = run.regions
        .filter((region) => !region.ignored)
        .reduce((sum, region) => sum + region.pixels, 0)
      run.mismatchRate = Number((run.mismatchRate * (pixelsAfter / pixelsBefore)).toFixed(2))
    }
    run.rulesVersion = db.rulesVersion
    run.recomputedAt = new Date().toISOString()
    run.recomputeReason = `忽略规则已变更，证据按规则 v${db.rulesVersion} 重算`
    recomputed += 1
  }
  return recomputed
}

const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
  const db = readDb()
  const method = (config.method ?? 'get').toLowerCase()
  const path = config.url ?? ''

  if (method === 'get' && path === '/projects') {
    return respond<Project[]>(config, db.projects)
  }

  if (method === 'get' && path === '/dashboard') {
    const dashboard: DashboardData = {
      pendingReview: db.runs.filter((run) => run.status === 'pending').length,
      approvedToday: db.runs.filter(
        (run) => run.review?.decision === 'approved' && run.review.reviewedAt.startsWith('2026-09-29'),
      ).length,
      highRisk: db.runs.filter((run) => run.mismatchRate >= 5 && run.status !== 'merged').length,
      activeBaselines: db.baselines.filter((baseline) => baseline.active).length,
      trend: [
        { date: '09-23', total: 36, failed: 7 },
        { date: '09-24', total: 42, failed: 4 },
        { date: '09-25', total: 39, failed: 9 },
        { date: '09-26', total: 47, failed: 6 },
        { date: '09-27', total: 44, failed: 5 },
        { date: '09-28', total: 52, failed: 11 },
        { date: '09-29', total: 29, failed: 8 },
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

    // 审批前核对：以服务端当前状态为准，校验提交方看到的规则版本与有效基线
    const activeBaseline = findActiveBaseline(db, run)
    const currentBaselineId = activeBaseline?.id ?? null
    const conflicts: string[] = []
    if (run.status !== 'pending') {
      conflicts.push(
        `该运行已由 ${run.review?.reviewer ?? '其他评审人'} 处理为「${statusLabel(run)}」，本次提交未生效`,
      )
    }
    if (payload.expectedRulesVersion !== run.rulesVersion) {
      conflicts.push(
        `忽略规则已更新到 v${run.rulesVersion}（本次提交基于 v${payload.expectedRulesVersion}），差异证据已重算，请刷新后重新评审`,
      )
    }
    if (payload.expectedBaselineId !== currentBaselineId) {
      conflicts.push(
        `当前有效基线已变为 ${activeBaseline?.version ?? '无'}${
          activeBaseline ? `（${activeBaseline.approvedBy} 批准）` : ''
        }，落后的一方不能覆盖新基线`,
      )
    }
    if (conflicts.length > 0) {
      // 落后的一方：不改状态、不动基线，只留冲突说明
      run.conflicts = run.conflicts ?? []
      run.conflicts.unshift({
        reviewer: payload.reviewer,
        decision: payload.decision,
        reason: payload.reason,
        conflict: conflicts.join('；'),
        attemptedAt: new Date().toISOString(),
      })
      writeDb(db)
      throw new ReviewConflictError(`提交未生效，已保留冲突说明：${conflicts.join('；')}`)
    }

    run.status = payload.decision
    run.review = {
      category: payload.category,
      decision: payload.decision,
      reviewer: payload.reviewer,
      reason: payload.reason,
      reviewedAt: new Date().toISOString(),
      rulesVersion: run.rulesVersion,
      baselineId: currentBaselineId ?? undefined,
      baselineVersion: activeBaseline?.version ?? run.baselineVersion,
    }
    if (payload.decision === 'approved') {
      if (activeBaseline) activeBaseline.active = false
      db.baselines.unshift({
        id: `base-${Date.now()}`,
        projectId: run.projectId,
        page: run.page,
        device: run.device,
        theme: run.theme,
        version: run.currentVersion,
        approvedBy: payload.reviewer,
        reason: payload.reason,
        approvedAt: new Date().toISOString(),
        runId: run.id,
        active: true,
      })
    }
    writeDb(db)
    return respond(config, run)
  }

  if (method === 'post' && path === '/runs/merge') {
    const ids = parseBody<string[]>(config)
    const selected = db.runs.filter((run) => ids.includes(run.id))
    if (selected.length < 2) throw new Error('至少选择两条运行记录进行合并')
    const [first, ...rest] = selected
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
        baselineVersion: payload.baselineVersion.trim() || '当前有效基线',
        currentVersion: payload.currentVersion.trim() || payload.build.trim(),
        baselineImage: payload.baselineImage,
        currentImage: file.dataUrl,
        rulesVersion: db.rulesVersion,
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
    for (const run of imported) {
      run.baselineId = findActiveBaseline(db, run)?.id
    }
    db.runs.unshift(...imported)
    writeDb(db)
    return respond(config, imported, 201)
  }

  if (method === 'get' && path === '/batches') {
    return respond<ReleaseBatch[]>(config, db.batches)
  }

  if (method === 'post' && path === '/batches/lock') {
    const payload = parseBody<{ id: string; locked: boolean; operator: string }>(config)
    const batch = db.batches.find((item) => item.id === payload.id)
    if (!batch) throw new Error('发布批次不存在')
    batch.locked = payload.locked
    if (payload.locked) {
      batch.lockedBy = payload.operator
      batch.lockedAt = new Date().toISOString()
      batch.lockedRulesVersion = db.rulesVersion
    } else {
      delete batch.lockedBy
      delete batch.lockedAt
      delete batch.lockedRulesVersion
    }
    writeDb(db)
    return respond(config, batch)
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
    const input = parseBody<Omit<IgnoreRule, 'id' | 'createdAt'>>(config)
    const rule: IgnoreRule = {
      ...input,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    db.rules.unshift(rule)
    db.rulesVersion += 1
    recomputePendingRuns(db)
    writeDb(db)
    return respond(config, rule, 201)
  }

  const ruleMatch = path.match(/^\/rules\/([^/]+)$/)
  if (method === 'patch' && ruleMatch) {
    const payload = parseBody<Partial<IgnoreRule>>(config)
    const rule = db.rules.find((item) => item.id === ruleMatch[1])
    if (!rule) throw new Error('规则不存在')
    Object.assign(rule, payload)
    db.rulesVersion += 1
    recomputePendingRuns(db)
    writeDb(db)
    return respond(config, rule)
  }
  if (method === 'delete' && ruleMatch) {
    const index = db.rules.findIndex((item) => item.id === ruleMatch[1])
    if (index < 0) throw new Error('规则不存在')
    db.rules.splice(index, 1)
    db.rulesVersion += 1
    recomputePendingRuns(db)
    writeDb(db)
    return respond(config, { success: true })
  }

  throw new Error(`Mock API 未实现：${method.toUpperCase()} ${path}`)
}

api.defaults.adapter = mockAdapter

export const getProjects = async (): Promise<Project[]> => (await api.get<Project[]>('/projects')).data
export const getDashboard = async (): Promise<DashboardData> =>
  (await api.get<DashboardData>('/dashboard')).data
export const getRuns = async (filters: RunFilters = {}): Promise<ScreenshotRun[]> =>
  (await api.get<ScreenshotRun[]>('/runs', { params: filters })).data
export const getRun = async (id: string): Promise<ScreenshotRun> =>
  (await api.get<ScreenshotRun>(`/runs/${id}`)).data
export const reviewRun = async (id: string, payload: ReviewPayload): Promise<ScreenshotRun> =>
  (await api.patch<ScreenshotRun>(`/runs/${id}/review`, payload)).data
export const mergeRuns = async (ids: string[]): Promise<ScreenshotRun> =>
  (await api.post<ScreenshotRun>('/runs/merge', ids)).data
export const importRuns = async (payload: ImportRunPayload): Promise<ScreenshotRun[]> =>
  (await api.post<ScreenshotRun[]>('/runs/import', payload)).data
export const getBaselines = async (projectId?: string): Promise<Baseline[]> =>
  (await api.get<Baseline[]>('/baselines', { params: { projectId } })).data
export const getBatches = async (): Promise<ReleaseBatch[]> =>
  (await api.get<ReleaseBatch[]>('/batches')).data
export const setBatchLock = async (
  id: string,
  locked: boolean,
  operator: string,
): Promise<ReleaseBatch> =>
  (await api.post<ReleaseBatch>('/batches/lock', { id, locked, operator })).data
export const getRules = async (): Promise<IgnoreRule[]> =>
  (await api.get<IgnoreRule[]>('/rules')).data
export const createRule = async (
  payload: Omit<IgnoreRule, 'id' | 'createdAt'>,
): Promise<IgnoreRule> => (await api.post<IgnoreRule>('/rules', payload)).data
export const toggleRule = async (id: string, enabled: boolean): Promise<IgnoreRule> =>
  (await api.patch<IgnoreRule>(`/rules/${id}`, { enabled })).data
export const deleteRule = async (id: string): Promise<{ success: boolean }> =>
  (await api.delete<{ success: boolean }>(`/rules/${id}`)).data
