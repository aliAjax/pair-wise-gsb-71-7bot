import type { Baseline, DifferenceRegion, IgnoreRule, Project, ReleaseBatch, ScreenshotRun } from '@/types'

const STORAGE_KEY = 'visual-regression-platform-v1'
const BACKUP_KEY = 'visual-regression-platform-v1-backup'

export interface Database {
  projects: Project[]
  runs: ScreenshotRun[]
  baselines: Baseline[]
  rules: IgnoreRule[]
  batches: ReleaseBatch[]
  /** 忽略规则的全局版本，任何规则增删改都会递增 */
  rulesVersion: number
}

const projects: Project[] = [
  { id: 'p-commerce', name: '零售交易工作台', code: 'RETAIL', owner: '沈宁', pageCount: 42 },
  { id: 'p-console', name: '云资源控制台', code: 'CLOUD', owner: '周航', pageCount: 67 },
  { id: 'p-growth', name: '增长运营平台', code: 'GROWTH', owner: '许薇', pageCount: 31 },
]

const makeRegions = (prefix: string, intensity: number): DifferenceRegion[] => [
  {
    id: `${prefix}-r1`,
    x: 11,
    y: 18,
    width: 28,
    height: 16,
    severity: 'high',
    pixels: Math.round(1840 * intensity),
    kind: 'layout',
    ignored: false,
  },
  {
    id: `${prefix}-r2`,
    x: 54,
    y: 34,
    width: 19,
    height: 11,
    severity: 'medium',
    pixels: Math.round(720 * intensity),
    kind: 'color',
    ignored: false,
  },
  {
    id: `${prefix}-r3`,
    x: 72,
    y: 71,
    width: 18,
    height: 13,
    severity: 'low',
    pixels: Math.round(216 * intensity),
    kind: 'environment',
    ignored: true,
    ruleId: 'rule-time',
  },
]

const SEED_RULES_VERSION = 3

const runs: ScreenshotRun[] = [
  {
    id: 'run-1048',
    name: '结算页桌面端回归',
    projectId: 'p-commerce',
    page: '订单结算页',
    device: 'Desktop 1440',
    theme: 'light',
    build: 'release/6.18.0',
    status: 'pending',
    mismatchRate: 3.82,
    capturedAt: '2026-09-29T08:42:00+08:00',
    baselineVersion: 'v6.17.4-baseline',
    currentVersion: 'v6.18.0-rc2',
    regions: makeRegions('1048', 1),
    rulesVersion: SEED_RULES_VERSION,
    baselineId: 'base-commerce-checkout',
  },
  {
    id: 'run-1047',
    name: '商品列表移动端回归',
    projectId: 'p-commerce',
    page: '商品列表页',
    device: 'iPhone 15',
    theme: 'light',
    build: 'release/6.18.0',
    status: 'pending',
    mismatchRate: 1.36,
    capturedAt: '2026-09-29T08:36:00+08:00',
    baselineVersion: 'v6.17.4-baseline',
    currentVersion: 'v6.18.0-rc2',
    regions: makeRegions('1047', 0.7),
    rulesVersion: SEED_RULES_VERSION,
    baselineId: 'base-commerce-list',
  },
  {
    id: 'run-1046',
    name: '账单明细暗色主题回归',
    projectId: 'p-console',
    page: '账单明细',
    device: 'Desktop 1920',
    theme: 'dark',
    build: 'feature/billing-v3',
    status: 'approved',
    mismatchRate: 5.14,
    capturedAt: '2026-09-28T17:20:00+08:00',
    baselineVersion: 'v5.9.1-baseline',
    currentVersion: 'billing-v3.7',
    regions: makeRegions('1046', 1.4),
    rulesVersion: SEED_RULES_VERSION,
    baselineId: 'base-console-billing',
    review: {
      category: 'design-change',
      decision: 'approved',
      reviewer: '林默',
      reason: '新计费周期列按需求上线，已核对设计稿和验收单。',
      reviewedAt: '2026-09-28T18:02:00+08:00',
      rulesVersion: SEED_RULES_VERSION,
      baselineId: 'base-console-billing',
      baselineVersion: 'v5.9.1-baseline',
    },
  },
  {
    id: 'run-1045',
    name: '活动配置页移动端回归',
    projectId: 'p-growth',
    page: '活动配置',
    device: 'Android Pixel 8',
    theme: 'light',
    build: 'feature/campaign-editor',
    status: 'rejected',
    mismatchRate: 10.73,
    capturedAt: '2026-09-28T15:11:00+08:00',
    baselineVersion: 'v2.4.0-baseline',
    currentVersion: 'campaign-v2',
    regions: makeRegions('1045', 2.2),
    rulesVersion: SEED_RULES_VERSION,
    baselineId: 'base-growth-campaign',
    review: {
      category: 'render-error',
      decision: 'rejected',
      reviewer: '梁琪',
      reason: '主操作区被侧栏遮挡，属于阻断性渲染异常。',
      reviewedAt: '2026-09-28T15:44:00+08:00',
      rulesVersion: SEED_RULES_VERSION,
      baselineId: 'base-growth-campaign',
      baselineVersion: 'v2.4.0-baseline',
    },
  },
  {
    id: 'run-1044',
    name: '资源详情页桌面端回归',
    projectId: 'p-console',
    page: '资源详情',
    device: 'Desktop 1440',
    theme: 'light',
    build: 'release/5.10.0',
    status: 'pending',
    mismatchRate: 2.08,
    capturedAt: '2026-09-28T13:30:00+08:00',
    baselineVersion: 'v5.9.1-baseline',
    currentVersion: 'v5.10.0-rc1',
    regions: makeRegions('1044', 0.9),
    rulesVersion: SEED_RULES_VERSION,
    baselineId: 'base-console-resource',
  },
  {
    id: 'run-1043',
    name: '首页推荐位回归',
    projectId: 'p-growth',
    page: '运营首页',
    device: 'Desktop 1440',
    theme: 'light',
    build: 'release/2.6.0',
    status: 'pending',
    mismatchRate: 0.94,
    capturedAt: '2026-09-27T19:15:00+08:00',
    baselineVersion: 'v2.5.3-baseline',
    currentVersion: 'v2.6.0-rc3',
    regions: makeRegions('1043', 0.5),
    rulesVersion: SEED_RULES_VERSION,
    baselineId: 'base-growth-home',
  },
]

const baselines: Baseline[] = [
  {
    id: 'base-commerce-checkout',
    projectId: 'p-commerce',
    page: '订单结算页',
    device: 'Desktop 1440',
    theme: 'light',
    version: 'v6.17.4-baseline',
    approvedBy: '林默',
    reason: '合入优惠券区域改版，设计稿版本 DS-318。',
    approvedAt: '2026-09-19T11:30:00+08:00',
    runId: 'run-998',
    active: true,
  },
  {
    id: 'base-console-billing-v3',
    projectId: 'p-console',
    page: '账单明细',
    device: 'Desktop 1920',
    theme: 'dark',
    version: 'billing-v3.7',
    approvedBy: '林默',
    reason: '新计费周期列按需求上线，已核对设计稿和验收单。',
    approvedAt: '2026-09-28T18:02:00+08:00',
    runId: 'run-1046',
    active: true,
  },
  {
    id: 'base-console-billing',
    projectId: 'p-console',
    page: '账单明细',
    device: 'Desktop 1920',
    theme: 'dark',
    version: 'v5.9.1-baseline',
    approvedBy: '周航',
    reason: '升级账单表格主题变量，无业务布局变化。',
    approvedAt: '2026-09-12T14:05:00+08:00',
    runId: 'run-961',
    active: false,
  },
  {
    id: 'base-growth-campaign',
    projectId: 'p-growth',
    page: '活动配置',
    device: 'Android Pixel 8',
    theme: 'light',
    version: 'v2.4.0-baseline',
    approvedBy: '许薇',
    reason: '第一版移动端活动配置工作台基线。',
    approvedAt: '2026-08-28T10:10:00+08:00',
    runId: 'run-902',
    active: false,
  },
  {
    id: 'base-commerce-list',
    projectId: 'p-commerce',
    page: '商品列表页',
    device: 'iPhone 15',
    theme: 'light',
    version: 'v6.17.4-baseline',
    approvedBy: '沈宁',
    reason: '商品卡信息密度调整完成，已通过交互验收。',
    approvedAt: '2026-09-20T16:40:00+08:00',
    runId: 'run-1002',
    active: true,
  },
  {
    id: 'base-console-resource',
    projectId: 'p-console',
    page: '资源详情',
    device: 'Desktop 1440',
    theme: 'light',
    version: 'v5.9.1-baseline',
    approvedBy: '周航',
    reason: '资源详情页首版基线，覆盖核心指标卡。',
    approvedAt: '2026-09-10T10:00:00+08:00',
    runId: 'run-955',
    active: true,
  },
  {
    id: 'base-growth-home',
    projectId: 'p-growth',
    page: '运营首页',
    device: 'Desktop 1440',
    theme: 'light',
    version: 'v2.5.3-baseline',
    approvedBy: '许薇',
    reason: '推荐位改版验收通过，固化为首页基线。',
    approvedAt: '2026-09-15T09:20:00+08:00',
    runId: 'run-990',
    active: true,
  },
]

const rules: IgnoreRule[] = [
  {
    id: 'rule-time',
    name: '动态时间区域',
    projectId: 'all',
    selector: '[data-visual-ignore="relative-time"]',
    pagePattern: '*',
    devicePattern: '*',
    maxDelta: 12,
    enabled: true,
    createdAt: '2026-09-02T09:00:00+08:00',
  },
  {
    id: 'rule-avatar',
    name: '用户头像随机图',
    projectId: 'p-commerce',
    selector: '.user-avatar img',
    pagePattern: '/checkout/*',
    devicePattern: '*',
    maxDelta: 20,
    enabled: true,
    createdAt: '2026-09-05T13:25:00+08:00',
  },
  {
    id: 'rule-watermark',
    name: '测试环境水印',
    projectId: 'all',
    selector: '.environment-watermark',
    pagePattern: '*',
    devicePattern: '*',
    maxDelta: 5,
    enabled: true,
    createdAt: '2026-08-21T11:08:00+08:00',
  },
  {
    id: 'rule-animation',
    name: '旧版骨架屏动画',
    projectId: 'p-console',
    selector: '.skeleton-shimmer',
    pagePattern: '*',
    devicePattern: 'iPhone*',
    maxDelta: 8,
    enabled: false,
    createdAt: '2026-08-16T17:12:00+08:00',
  },
]

const batches: ReleaseBatch[] = [
  {
    id: 'batch-6.18-freeze',
    name: '6.18.0 发布冻结批次',
    projectId: 'p-commerce',
    build: 'release/6.18.0',
    locked: false,
  },
  {
    id: 'batch-billing-v3',
    name: 'billing-v3 已锁定批次',
    projectId: 'p-console',
    build: 'feature/billing-v3',
    locked: true,
    lockedBy: '周航',
    lockedAt: '2026-09-28T19:00:00+08:00',
    lockedRulesVersion: SEED_RULES_VERSION,
  },
  {
    id: 'batch-5.10',
    name: '5.10.0 发布批次',
    projectId: 'p-console',
    build: 'release/5.10.0',
    locked: false,
  },
  {
    id: 'batch-2.6',
    name: '2.6.0 发布批次',
    projectId: 'p-growth',
    build: 'release/2.6.0',
    locked: false,
  },
  {
    id: 'batch-campaign',
    name: 'campaign-editor 批次',
    projectId: 'p-growth',
    build: 'feature/campaign-editor',
    locked: false,
  },
]

const seed = (): Database => ({
  projects,
  runs,
  baselines,
  rules,
  batches,
  rulesVersion: SEED_RULES_VERSION,
})

const baselineKey = (baseline: Pick<Baseline, 'projectId' | 'page' | 'device' | 'theme'>) =>
  [baseline.projectId, baseline.page, baseline.device, baseline.theme].join('|')

/**
 * 修复历史遗留数据，保证两条硬性状态约束：
 * 1. 已批准的运行必须留有历史基线；
 * 2. 同一项目 + 页面 + 设备 + 主题下最多只有一条有效基线。
 */
const repairDb = (db: Database): Database => {
  for (const run of db.runs) {
    if (run.status !== 'approved' || !run.review) continue
    const hasBaseline = db.baselines.some((baseline) => baseline.runId === run.id)
    if (!hasBaseline) {
      db.baselines.unshift({
        id: `base-repaired-${run.id}`,
        projectId: run.projectId,
        page: run.page,
        device: run.device,
        theme: run.theme,
        version: run.currentVersion,
        approvedBy: run.review.reviewer,
        reason: run.review.reason,
        approvedAt: run.review.reviewedAt,
        runId: run.id,
        active: true,
      })
    }
  }
  const activeByKey = new Map<string, Baseline[]>()
  for (const baseline of db.baselines) {
    if (!baseline.active) continue
    const key = baselineKey(baseline)
    const list = activeByKey.get(key) ?? []
    list.push(baseline)
    activeByKey.set(key, list)
  }
  for (const list of activeByKey.values()) {
    if (list.length <= 1) continue
    list.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
    for (const stale of list.slice(1)) stale.active = false
  }
  return db
}

/** 兼容旧版本本地数据：补齐新增字段 */
const migrate = (raw: Partial<Database>): Database => {
  const base = seed()
  const db: Database = {
    projects: raw.projects ?? base.projects,
    runs: raw.runs ?? base.runs,
    baselines: raw.baselines ?? base.baselines,
    rules: raw.rules ?? base.rules,
    batches: raw.batches ?? base.batches,
    rulesVersion: typeof raw.rulesVersion === 'number' ? raw.rulesVersion : SEED_RULES_VERSION,
  }
  for (const run of db.runs) {
    if (typeof run.rulesVersion !== 'number') run.rulesVersion = db.rulesVersion
  }
  return repairDb(db)
}

/**
 * 写入前校验状态约束，违反约束的数据一律不落库，
 * 避免出现“运行已批准却没有历史基线”或“同页面设备两条有效基线”的状态。
 */
const assertInvariants = (db: Database): void => {
  for (const run of db.runs) {
    if (run.status !== 'approved') continue
    const hasBaseline = db.baselines.some((baseline) => baseline.runId === run.id)
    if (!hasBaseline) {
      throw new Error(`运行 ${run.id} 已批准但缺少历史基线，本次写入已取消`)
    }
  }
  const activeKeys = new Set<string>()
  for (const baseline of db.baselines) {
    if (!baseline.active) continue
    const key = baselineKey(baseline)
    if (activeKeys.has(key)) {
      throw new Error(`页面「${baseline.page} · ${baseline.device}」存在两条有效基线，本次写入已取消`)
    }
    activeKeys.add(key)
  }
}

export const readDb = (): Database => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      return migrate(JSON.parse(raw) as Partial<Database>)
    } catch {
      // 主记录损坏，尝试从最近完整记录恢复
    }
  }
  const backup = localStorage.getItem(BACKUP_KEY)
  if (backup) {
    try {
      const recovered = migrate(JSON.parse(backup) as Partial<Database>)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recovered))
      return recovered
    } catch {
      // 备份同样不可用，退回种子数据
    }
  }
  const initial = seed()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

/**
 * 事务式写入：先把当前完整记录存入备份键，再写主记录。
 * 任何一步失败都会回滚到最近完整记录，并向调用方抛错。
 */
export const writeDb = (db: Database): void => {
  assertInvariants(db)
  const next = JSON.stringify(db)
  const previous = localStorage.getItem(STORAGE_KEY)
  try {
    if (previous !== null) localStorage.setItem(BACKUP_KEY, previous)
    localStorage.setItem(STORAGE_KEY, next)
  } catch (error) {
    try {
      if (previous !== null) localStorage.setItem(STORAGE_KEY, previous)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 回滚也失败时保留现场，下次读取会尝试从备份恢复
    }
    throw new Error(
      `写入失败，已从最近完整记录恢复：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
