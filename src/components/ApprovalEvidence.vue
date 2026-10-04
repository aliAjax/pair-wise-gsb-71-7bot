<script setup lang="ts">
import type { ScreenshotRun } from '@/types'
import { categoryLabel, conflictKindLabel, decisionLabel, formatTime, roleLabel } from '@/utils/approval'

defineProps<{ run: ScreenshotRun; compact?: boolean }>()
</script>

<template>
  <div class="approval-evidence">
    <div v-if="run.review" class="evidence-block" :class="run.review.decision">
      <div class="evidence-head">
        <a-tag :color="run.review.decision === 'approved' ? 'green' : 'red'" size="small">
          {{ decisionLabel(run.review.decision) }}
        </a-tag>
        <strong>{{ run.review.reviewer }}</strong>
        <a-tag size="small" color="gray">{{ roleLabel(run.review.role) }}</a-tag>
        <span class="muted">{{ formatTime(run.review.reviewedAt) }}</span>
      </div>
      <div v-if="!compact" class="evidence-meta">
        <span>变化类型：{{ categoryLabel(run.review.category) }}</span>
        <span>忽略规则版本：<code>v{{ run.review.rulesVersion }}</code></span>
        <span>
          批准依据基线：<code>{{ run.review.baselineVersion }}</code>
          <small v-if="run.baselineId">（{{ run.baselineId }}）</small>
        </span>
      </div>
      <p class="evidence-reason">{{ run.review.reason }}</p>
      <div v-if="run.lockedBatchId" class="locked-note">
        <icon-lock /> 已锁定发布批次 {{ run.lockedBatchId }}，冻结期内继续使用上述原证据。
      </div>
    </div>

    <a-alert
      v-if="run.conflict"
      class="conflict-alert"
      type="warning"
      :title="`${conflictKindLabel(run.conflict.kind)} · ${formatTime(run.conflict.conflictAt)}`"
    >
      <p>{{ run.conflict.message }}</p>
      <div v-if="!compact" class="conflict-meta">
        <span>提交方：{{ run.conflict.reviewer }}（{{ roleLabel(run.conflict.role) }}）</span>
        <span v-if="run.conflict.rivalReviewer">
          先落地方：{{ run.conflict.rivalReviewer }}（{{ run.conflict.rivalRole ? roleLabel(run.conflict.rivalRole) : '-' }}）
        </span>
        <span v-if="run.conflict.runRulesVersion !== undefined && run.conflict.currentRulesVersion !== undefined">
          规则版本：v{{ run.conflict.runRulesVersion }} → v{{ run.conflict.currentRulesVersion }}
        </span>
        <span v-if="run.conflict.runBaselineVersion && run.conflict.currentBaselineVersion">
          基线版本：{{ run.conflict.runBaselineVersion }} → {{ run.conflict.currentBaselineVersion }}
        </span>
      </div>
    </a-alert>

    <a-alert
      v-if="run.status === 'stale' && run.staleReason"
      class="conflict-alert"
      type="error"
      title="运行差异已失效，等待重算"
    >
      <p>{{ run.staleReason }}</p>
      <small v-if="run.rulesVersion !== undefined">本运行依据规则 v{{ run.rulesVersion }}</small>
    </a-alert>

    <span v-if="!run.review && !run.conflict && run.status !== 'stale'" class="muted">尚未审批</span>
  </div>
</template>

<style scoped>
.approval-evidence {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.evidence-block {
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid #00b42a;
  background: #f6ffed;
}
.evidence-block.rejected {
  border-left-color: #f53f3f;
  background: #fff2f0;
}
.evidence-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.evidence-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0;
  font-size: 12px;
  color: #4e5969;
}
.evidence-reason {
  margin: 4px 0 0;
  font-size: 13px;
}
.locked-note {
  margin-top: 6px;
  font-size: 12px;
  color: #165dff;
}
.conflict-alert p {
  margin: 0 0 4px;
}
.conflict-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #4e5969;
}
.muted {
  color: #86909c;
  font-size: 13px;
}
</style>
