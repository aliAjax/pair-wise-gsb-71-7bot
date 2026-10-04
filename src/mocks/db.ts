import type {
  Baseline,
  DifferenceRegion,
  IgnoreRule,
  Project,
  ReleaseBatch,
  RuleMeta,
  ScreenshotRun,
} from '@/types'

const STORAGE_KEY = 'visual-regression-platform-v2'
const BACKUP_KEY = 'visual-regression-platform-v2-backup'

interface Database {
  version: number
  projects: Project[]
  runs: ScreenshotRun[]
  baselines: Baseline[]
  rules: IgnoreRule[]
  batches: ReleaseBatch[]
  meta: RuleMeta
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

const CURRENT_RULES_VERSION = 3

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
    capturedAt: '2026-10-04T08:42:00+08:00',
    baselineVersion: 'v6.17.4-baseline',
    currentVersion: 'v6.18.0-rc2',
    rulesVersion: CURRENT_RULES_VERSION,
    regions: makeRegions('1048', 1),
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
    capturedAt: '2026-10-04T08:36:00+08:00',
    baselineVersion: 'v6.17.4-baseline',
    currentVersion: 'v6.18.0-rc2',
    rulesVersion: CURRENT_RULES_VERSION,
    regions: makeRegions('1047', 0.7),
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
    baselineVersion: 'v5.10.0-baseline',
    currentVersion: 'billing-v3.7',
    rulesVersion: 2,
    baselineId: 'base-console-billing-v510',
    regions: makeRegions('1046', 1.4),
    review: {
      category: 'design-change',
      decision: 'approved',
      reviewer: '林默',
      role: 'reviewer',
      reason: '新计费周期列按需求上线，已核对设计稿和验收单。',
      reviewedAt: '2026-10-02T18:02:00+08:00',
      rulesVersion: 2,
      baselineVersion: 'v5.10.0-baseline',
      baselineId: 'base-console-billing-v510',
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
    rulesVersion: 2,
    regions: makeRegions('1045', 2.2),
    review: {
      category: 'render-error',
      decision: 'rejected',
      reviewer: '梁琪',
      role: 'reviewer',
      reason: '主操作区被侧栏遮挡，属于阻断性渲染异常。',
      reviewedAt: '2026-09-28T15:44:00+08:00',
      rulesVersion: 2,
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
    status: 'stale',
    mismatchRate: 2.08,
    capturedAt: '2026-10-04T09:10:00+08:00',
    baselineVersion: 'v5.10.0-baseline',
    currentVersion: 'v5.10.0-rc1',
    // 规则已升到 v3，这条仍按 v1 计算，处于失效待重算状态
    rulesVersion: 1,
    staleReason: '忽略规则集已从 v1 升级到 v3（新增动态时间区域色差阈值），原差异结果失效，需重新计算。',
    regions: makeRegions('1044', 0.9),
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
    capturedAt: '2026-10-03T19:15:00+08:00',
    // 页面有效基线已经是 v2.6.1，这条运行仍按旧基线 v2.5.3 提交
    baselineVersion: 'v2.5.3-baseline',
    currentVersion: 'v2.6.0-rc3',
    rulesVersion: CURRENT_RULES_VERSION,
    regions: makeRegions('1043', 0.5),
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
    rulesVersion: 1,
  },
  {
    id: 'base-console-billing-v510',
    projectId: 'p-console',
    page: '账单明细',
    device: 'Desktop 1920',
    theme: 'dark',
    version: 'v5.10.0-baseline',
    approvedBy: '周航',
    reason: '升级账单表格主题变量，无业务布局变化。',
    approvedAt: '2026-10-02T17:40:00+08:00',
    runId: 'run-1046',
    active: true,
    rulesVersion: 2,
  },
  {
    id: 'base-console-billing',
    projectId: 'p-console',
    page: '账单明细',
    device: 'Desktop 1920',
    theme: 'dark',
    version: 'v5.9.1-baseline',
    approvedBy: '周航',
    reason: '旧版账单表格基线，已被 v5.10.0 替代。',
    approvedAt: '2026-09-12T14:05:00+08:00',
    runId: 'run-961',
    active: false,
    rulesVersion: 1,
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
    rulesVersion: 1,
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
    rulesVersion: 1,
  },
  {
    id: 'base-growth-home',
    projectId: 'p-growth',
    page: '运营首页',
    device: 'Desktop 1440',
    theme: 'light',
    version: 'v2.6.1-baseline',
    approvedBy: '许薇',
    reason: '推荐位策略升级后批准的新基线。',
    approvedAt: '2026-10-03T10:05:00+08:00',
    runId: 'run-1041',
    active: true,
    rulesVersion: CURRENT_RULES_VERSION,
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
    version: 2,
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
    version: 1,
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
    version: 3,
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
    version: 1,
  },
]

// 发布冻结期内已锁定的批次：即使规则继续变化，也沿用批准时固定的原证据
const batches: ReleaseBatch[] = [
  {
    id: 'batch-618-rc1',
    name: '6.18.0 发布冻结批次 RC1',
    projectId: 'p-commerce',
    build: 'release/6.18.0',
    lockedAt: '2026-10-03T20:00:00+08:00',
    lockedBy: '发布负责人 高岑',
    freeze: true,
    runIds: [],
    evidence: [
      {
        runId: 'run-1039',
        runName: '购物车页桌面端回归',
        baselineId: 'base-commerce-cart',
        baselineVersion: 'v6.17.4-baseline',
        rulesVersion: 2,
        approvedBy: '林默',
        approvedAt: '2026-10-03T18:22:00+08:00',
        reason: '购物车凑单栏样式按设计稿 DS-322 调整，批准为基线。',
      },
    ],
  },
]

const seed = (): Database =>
  structuredClone({
    version: 2,
    projects,
    runs,
    baselines,
    rules,
    batches,
    meta: {
      rulesVersion: CURRENT_RULES_VERSION,
      updatedAt: '2026-10-03T09:40:00+08:00',
      changedBy: '许薇',
      changeSummary: '收紧测试环境水印色差阈值至 5，动态时间区域阈值调整为 12。',
    },
  })

const isDatabase = (value: unknown): value is Database => {
  if (!value || typeof value !== 'object') return false
  const db = value as Record<string, unknown>
  return Array.isArray(db.runs) && Array.isArray(db.baselines) && Array.isArray(db.rules)
}

/** 数据库结构必须完整：缺数组、缺字段一律视为损坏记录 */
const isIntactDatabase = (db: Database): boolean => {
  if (!Array.isArray(db.projects) || !Array.isArray(db.runs) || !Array.isArray(db.baselines)) return false
  if (!Array.isArray(db.rules) || !Array.isArray(db.batches) || !db.meta) return false
  // 已批准运行必须带历史基线依据，且引用的基线真实存在
  const baselineIds = new Set(db.baselines.map((item) => item.id))
  const orphanApproval = db.runs.some(
    (run) =>
      (run.status === 'approved' || run.review?.decision === 'approved') &&
      (!run.review?.baselineVersion || !run.baselineId || !baselineIds.has(run.baselineId)),
  )
  if (orphanApproval) return false
  // 同一 项目/页面/设备/主题 至多保留一条有效基线
  const seen = new Set<string>()
  for (const baseline of db.baselines) {
    if (!baseline.active) continue
    const key = [baseline.projectId, baseline.page, baseline.device, baseline.theme].join('|')
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

export const readDb = (): Database => {
  const restoreSeed = (reason: string): Database => {
    const initial = seed()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...initial, meta: { ...initial.meta, changeSummary: `${reason}，已重置为内置完整记录。` } }),
    )
    return initial
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = seed()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return restoreSeed('主记录 JSON 解析失败')
  }
  if (!isDatabase(parsed)) return restoreSeed('主记录结构不完整')
  if (!isIntactDatabase(parsed)) return restoreSeed('主记录一致性校验未通过（批准缺历史基线或同页设备存在多条有效基线）')
  return parsed
}

/**
 * 写入：先把上一条完整记录存为备份，再尝试写入新记录。
 * 写入失败或新记录不完整时，从最近一条完整记录恢复，绝不留下坏状态。
 */
export const writeDb = (next: Database): void => {
  const currentRaw = localStorage.getItem(STORAGE_KEY)
  let lastGood: Database | null = null
  if (currentRaw) {
    try {
      const candidate = JSON.parse(currentRaw) as unknown
      if (isDatabase(candidate) && isIntactDatabase(candidate)) lastGood = candidate
    } catch {
      lastGood = null
    }
  }
  if (lastGood) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(lastGood))
    } catch {
      // 备份写入失败不能阻断主流程，最近完整记录仍在主键中
    }
  }

  if (!isIntactDatabase(next)) {
    if (lastGood) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGood))
      throw new Error('写入记录未通过完整性校验，已从最近完整记录恢复')
    }
    const fresh = seed()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    throw new Error('写入记录未通过完整性校验，且无可用备份，已重置为内置记录')
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    if (lastGood) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGood))
      throw new Error('写入失败，已从最近完整记录恢复')
    }
    throw new Error('写入失败，且没有可恢复的完整记录')
  }

  // 写入后立即回读确认，防止半截数据被当成有效状态
  const verifyRaw = localStorage.getItem(STORAGE_KEY)
  try {
    const verified = JSON.parse(verifyRaw ?? 'null') as unknown
    if (!isDatabase(verified) || !isIntactDatabase(verified)) throw new Error('verify failed')
  } catch {
    if (lastGood) localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGood))
    throw new Error('写入后校验失败，已从最近完整记录恢复')
  }
}

export const STORAGE_VERSION = 2
