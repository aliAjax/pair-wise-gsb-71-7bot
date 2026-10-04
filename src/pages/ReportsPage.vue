<script setup lang="ts">
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useQuery } from '@tanstack/vue-query'
import { getBaselines, getRuns } from '@/api/http'
import StatusTag from '@/components/StatusTag.vue'
import ApprovalEvidence from '@/components/ApprovalEvidence.vue'
import { approvalSummary, conflictKindLabel, roleLabel, statusLabel } from '@/utils/approval'

const dateRange = ref('last-7-days')
const { data: runs } = useQuery({ queryKey: ['runs', 'reports'], queryFn: () => getRuns() })
const { data: baselines } = useQuery({ queryKey: ['baselines', 'reports'], queryFn: () => getBaselines() })

const summary = computed(() => ({
  total: runs.value?.length ?? 0,
  failed: runs.value?.filter((run) => run.mismatchRate > 0).length ?? 0,
  approved: runs.value?.filter((run) => run.status === 'approved').length ?? 0,
  baselines: baselines.value?.length ?? 0,
  conflicts: runs.value?.filter((run) => Boolean(run.conflict)).length ?? 0,
  stale: runs.value?.filter((run) => run.status === 'stale').length ?? 0,
}))

const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

const exportCsv = () => {
  const rows = [
    [
      '运行ID',
      '页面',
      '设备',
      '主题',
      '构建',
      '审批结果',
      '差异率',
      '差异区域',
      '审批人',
      '窗口角色',
      '规则版本依据',
      '历史基线依据',
      '冲突类型',
      '冲突说明',
      '审批原因',
    ],
    ...(runs.value ?? []).map((run) => [
      run.id,
      run.page,
      run.device,
      run.theme === 'light' ? '浅色' : '深色',
      run.build,
      run.review ? statusLabel(run.status) : statusLabel(run.status),
      run.mismatchRate.toFixed(2),
      run.regions.length,
      run.review?.reviewer ?? '',
      run.review ? roleLabel(run.review.role) : '',
      run.review ? `v${run.review.rulesVersion}` : `v${run.rulesVersion ?? ''}`,
      run.review?.baselineVersion ?? run.baselineVersion,
      run.conflict ? conflictKindLabel(run.conflict.kind) : '',
      run.conflict?.message ?? '',
      run.review?.reason ?? '',
    ]),
  ]
  const csv = `﻿${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `visual-regression-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  Message.success('结果 CSV 已导出，审批结果、规则与基线依据与页面展示一致')
}
</script>

<template>
  <section class="page-intro compact">
    <div>
      <h2>结果汇总与导出</h2>
      <p>列表与导出共用同一份审批结果与依据：结论、审批人、窗口角色、规则版本、历史基线和冲突说明。</p>
    </div>
    <a-space>
      <a-select v-model="dateRange" style="width: 150px">
        <a-option value="last-7-days">最近 7 天</a-option>
        <a-option value="last-30-days">最近 30 天</a-option>
        <a-option value="current-release">当前发布周期</a-option>
      </a-select>
      <a-button type="primary" @click="exportCsv"><icon-download /> 导出 CSV</a-button>
    </a-space>
  </section>

  <div class="metric-grid report-metrics">
    <div class="metric-panel tone-blue"><div class="metric-label">总运行</div><div class="metric-value">{{ summary.total }}</div><div class="metric-note">当前筛选范围</div></div>
    <div class="metric-panel tone-green"><div class="metric-label">批准运行</div><div class="metric-value">{{ summary.approved }}</div><div class="metric-note">均含历史基线依据</div></div>
    <div class="metric-panel tone-orange"><div class="metric-label">冲突留痕</div><div class="metric-value">{{ summary.conflicts }}</div><div class="metric-note">未覆盖任何结论</div></div>
    <div class="metric-panel tone-red"><div class="metric-label">失效待重算</div><div class="metric-value">{{ summary.stale }}</div><div class="metric-note">规则版本落后</div></div>
  </div>

  <a-card class="table-panel" :bordered="false">
    <template #title>发布质量明细</template>
    <template #extra><span class="muted">导出字段与下列审批结果、依据完全一致</span></template>
    <a-table :data="runs" :pagination="{ pageSize: 10 }" row-key="id">
      <template #columns>
        <a-table-column title="运行" data-index="name" :width="200" />
        <a-table-column title="页面 / 设备" :width="190">
          <template #cell="{ record }">{{ record.page }} · {{ record.device }}</template>
        </a-table-column>
        <a-table-column title="构建" data-index="build" :width="160" />
        <a-table-column title="差异率" :width="90">
          <template #cell="{ record }">{{ record.mismatchRate.toFixed(2) }}%</template>
        </a-table-column>
        <a-table-column title="结果" :width="110">
          <template #cell="{ record }"><StatusTag :status="record.status" /></template>
        </a-table-column>
        <a-table-column title="审批结果与依据" :width="360">
          <template #cell="{ record }">
            <ApprovalEvidence :run="record" compact />
            <small v-if="record.review" class="sub-text">{{ approvalSummary(record.review) }}</small>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </a-card>
</template>
