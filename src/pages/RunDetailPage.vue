<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Message } from '@arco-design/web-vue'
import DiffCanvas from '@/components/DiffCanvas.vue'
import StatusTag from '@/components/StatusTag.vue'
import ApprovalEvidence from '@/components/ApprovalEvidence.vue'
import { getBaselines, getMeta, getRun, recomputeRun, reviewRun } from '@/api/http'
import { useReviewStore } from '@/stores/review'
import type { DifferenceRegion, ReviewCategory, ReviewRole } from '@/types'

interface ReviewForm {
  category: ReviewCategory
  decision: 'approved' | 'rejected'
  reviewer: string
  role: ReviewRole
  reason: string
}

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const reviewStore = useReviewStore()
const runId = computed(() => String(route.params.id))
const localRegions = ref<DifferenceRegion[]>([])

const form = reactive<ReviewForm>({
  category: 'design-change',
  decision: 'approved',
  reviewer: '林默',
  role: 'reviewer',
  reason: '',
})

const { data: run, isLoading } = useQuery({
  queryKey: computed(() => ['run', runId.value]),
  queryFn: () => getRun(runId.value),
})

const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: getMeta })

const { data: baselines } = useQuery({ queryKey: ['baselines', 'all'], queryFn: () => getBaselines() })

// 当前有效基线，以服务端数据为准；审批前必须与它核对
const activeBaseline = computed(() =>
  baselines.value?.find(
    (item) =>
      run.value &&
      item.projectId === run.value.projectId &&
      item.page === run.value.page &&
      item.device === run.value.device &&
      item.theme === run.value.theme &&
      item.active,
  ),
)

const rulesBehind = computed(
  () => (run.value?.rulesVersion ?? 0) < (meta.value?.rulesVersion ?? 0),
)
const baselineBehind = computed(
  () => Boolean(run.value && activeBaseline.value && run.value.baselineVersion !== activeBaseline.value.version),
)

watch(
  run,
  (value) => {
    if (value) localRegions.value = value.regions.map((region) => ({ ...region }))
    reviewStore.setDifferenceFilter('all')
  },
  { immediate: true },
)

const visibleRegions = computed(() =>
  localRegions.value.filter(
    (region) =>
      reviewStore.differenceFilter === 'all' || region.severity === reviewStore.differenceFilter,
  ),
)

const suspiciousPixels = computed(() =>
  localRegions.value
    .filter((region) => !region.ignored)
    .reduce((total, region) => total + region.pixels, 0),
)

const refreshAll = async () => {
  await queryClient.invalidateQueries({ queryKey: ['run', runId.value] })
  await queryClient.invalidateQueries({ queryKey: ['runs'] })
  await queryClient.invalidateQueries({ queryKey: ['baselines'] })
  await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  await queryClient.invalidateQueries({ queryKey: ['meta'] })
}

const reviewMutation = useMutation({
  mutationFn: (payload: ReviewForm) =>
    reviewRun(runId.value, {
      category: payload.category,
      decision: payload.decision,
      reviewer: payload.reviewer,
      role: payload.role,
      reason: payload.reason,
      // 窗口中看到的规则版本与有效基线，提交给服务端复核
      expectedRulesVersion: meta.value?.rulesVersion ?? 0,
      expectedBaselineVersion: activeBaseline.value?.version ?? run.value?.baselineVersion ?? '',
    }),
  onSuccess: async (result) => {
    if (result.conflict) {
      Message.warning(`审批未生效：${result.conflict.message}`)
      await refreshAll()
      return
    }
    Message.success(
      result.run.review?.decision === 'approved'
        ? '审批通过，新基线已按当前规则版本与有效基线留痕'
        : '已驳回并保留原基线',
    )
    await refreshAll()
    await router.push('/approvals')
  },
  onError: async (error: Error) => {
    Message.error(error.message)
    await refreshAll()
  },
})

const recomputeMutation = useMutation({
  mutationFn: () => recomputeRun(runId.value),
  onSuccess: async () => {
    Message.success('已按当前忽略规则版本重新计算差异，运行重新进入待审批')
    await refreshAll()
  },
  onError: (error: Error) => Message.error(error.message),
})

const toggleIgnored = (target: DifferenceRegion) => {
  const region = localRegions.value.find((item) => item.id === target.id)
  if (region) region.ignored = !region.ignored
}

const handleDifferenceFilter = (value: string | number | boolean) => {
  const allowed = ['all', 'high', 'medium', 'low']
  if (allowed.includes(String(value))) {
    reviewStore.setDifferenceFilter(String(value) as 'all' | 'high' | 'medium' | 'low')
  }
}

const submitReview = () => {
  if (!form.reason.trim()) {
    Message.warning('请填写审批原因')
    return
  }
  if (run.value?.status === 'stale' || rulesBehind.value) {
    Message.warning('规则已变化，请先重新计算运行再审批')
    return
  }
  reviewMutation.mutate({ ...form })
}

const roleNames: Record<ReviewRole, string> = {
  reviewer: '林默',
  'release-manager': '高岑',
}

const switchRole = (role: string | number | boolean) => {
  const next = String(role) as ReviewRole
  form.role = next
  form.reviewer = roleNames[next]
}
</script>

<template>
  <a-spin :loading="isLoading" style="width: 100%">
    <template v-if="run">
      <section class="detail-heading">
        <div>
          <a-space>
            <h2>{{ run.name }}</h2>
            <StatusTag :status="run.status" />
            <a-tag v-if="run.lockedBatchId" color="arcoblue"><icon-lock /> {{ run.lockedBatchId }}</a-tag>
          </a-space>
          <p>{{ run.page }} · {{ run.device }} · {{ run.theme === 'light' ? '浅色主题' : '深色主题' }}</p>
        </div>
        <a-space>
          <a-button @click="router.push('/runs')"><icon-left /> 返回列表</a-button>
          <a-button
            v-if="run.status === 'stale' || rulesBehind"
            type="outline"
            :loading="recomputeMutation.isPending.value"
            @click="recomputeMutation.mutate()"
          >
            <icon-refresh /> 按当前规则重算
          </a-button>
          <a-button
            type="primary"
            :loading="reviewMutation.isPending.value"
            :disabled="Boolean(run.lockedBatchId)"
            @click="submitReview"
          >
            <icon-check /> 提交审批
          </a-button>
        </a-space>
      </section>

      <a-alert v-if="run.lockedBatchId" type="info" style="margin-bottom: 12px">
        运行已锁定到发布冻结批次，继续使用批准时的规则版本与基线证据，规则后续变化不影响本批次。
      </a-alert>

      <div class="run-facts">
        <div><span>差异率</span><strong :class="{ danger: run.mismatchRate >= 5 }">{{ run.mismatchRate.toFixed(2) }}%</strong></div>
        <div><span>待判定像素</span><strong>{{ suspiciousPixels.toLocaleString() }}</strong></div>
        <div><span>运行标识</span><strong>{{ run.id }}</strong></div>
        <div><span>构建链路</span><strong>{{ run.baselineVersion }} → {{ run.currentVersion }}</strong></div>
      </div>

      <a-card class="version-panel" :bordered="false">
        <div class="version-grid">
          <div class="version-item" :class="{ behind: rulesBehind }">
            <span>运行忽略规则版本</span>
            <strong>v{{ run.rulesVersion ?? '-' }}</strong>
            <small :class="{ warning: rulesBehind }">
              当前有效规则 v{{ meta?.rulesVersion ?? '-' }} · {{ rulesBehind ? '落后，运行失效需重算' : '一致' }}
            </small>
          </div>
          <div class="version-item" :class="{ behind: baselineBehind }">
            <span>运行核对基线</span>
            <strong>{{ run.baselineVersion }}</strong>
            <small :class="{ warning: baselineBehind }">
              当前有效基线 {{ activeBaseline?.version ?? '无' }} · {{ baselineBehind ? '落后，不能盖掉新基线' : '一致' }}
            </small>
          </div>
          <div class="version-item">
            <span>规则最近变更</span>
            <strong>v{{ meta?.rulesVersion ?? '-' }}</strong>
            <small>{{ meta?.changedBy }} · {{ meta?.updatedAt.slice(0, 16).replace('T', ' ') }}</small>
          </div>
        </div>
        <p class="version-summary">{{ meta?.changeSummary }}</p>
      </a-card>

      <div class="review-workspace">
        <div class="comparison-area">
          <div class="compare-toolbar">
            <a-space>
              <span class="toolbar-label">差异筛选</span>
              <a-radio-group
                type="button"
                :model-value="reviewStore.differenceFilter"
                size="small"
                @change="handleDifferenceFilter"
              >
                <a-radio value="all">全部</a-radio>
                <a-radio value="high">高</a-radio>
                <a-radio value="medium">中</a-radio>
                <a-radio value="low">低</a-radio>
              </a-radio-group>
            </a-space>
            <a-space>
              <a-button-group size="small">
                <a-button @click="reviewStore.setZoom(reviewStore.zoom - 10)"><icon-zoom-out /></a-button>
                <a-button>{{ reviewStore.zoom }}%</a-button>
                <a-button @click="reviewStore.setZoom(reviewStore.zoom + 10)"><icon-zoom-in /></a-button>
              </a-button-group>
              <a-button size="small" @click="reviewStore.setZoom(100)"><icon-refresh /> 复位</a-button>
            </a-space>
          </div>
          <div class="canvas-grid">
            <DiffCanvas :run="run" side="baseline" :zoom="reviewStore.zoom" :regions="visibleRegions" />
            <DiffCanvas :run="run" side="current" :zoom="reviewStore.zoom" :regions="visibleRegions" />
          </div>
        </div>

        <aside class="review-panel">
          <div class="panel-title">
            <div>
              <h3>差异区域</h3>
              <span>已按当前筛选展示 {{ visibleRegions.length }} 处</span>
            </div>
            <a-tag color="red">{{ localRegions.filter((item) => !item.ignored).length }} 待判定</a-tag>
          </div>
          <div class="region-list">
            <button
              v-for="region in visibleRegions"
              :key="region.id"
              class="region-item"
              :class="{ ignored: region.ignored }"
              @click="toggleIgnored(region)"
            >
              <span class="region-severity" :class="region.severity">{{ region.severity.toUpperCase() }}</span>
              <span class="region-copy">
                <strong>{{ region.kind === 'layout' ? '布局位移' : region.kind === 'color' ? '色彩变化' : region.kind === 'content' ? '内容变更' : '环境噪声' }}</strong>
                <small>区域 {{ region.x }}%, {{ region.y }}% · {{ region.pixels.toLocaleString() }} px</small>
              </span>
              <span class="ignore-action">{{ region.ignored ? '恢复' : '忽略' }}</span>
            </button>
          </div>

          <a-divider />

          <ApprovalEvidence :run="run" />

          <div class="panel-title" style="margin-top: 12px">
            <div>
              <h3>评审结论</h3>
              <span>冻结期内评审人与发布负责人在不同窗口提交，以先落地且版本核对通过者为准</span>
            </div>
          </div>
          <a-form :model="form" layout="vertical" @submit-success="submitReview">
            <a-form-item label="提交窗口身份" :rules="[{ required: true }]">
              <a-radio-group type="button" :model-value="form.role" @change="switchRole">
                <a-radio value="reviewer">评审人窗口</a-radio>
                <a-radio value="release-manager">发布负责人窗口</a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item
              field="category"
              label="变化类型"
              :rules="[{ required: true, message: '请选择变化类型' }]"
            >
              <a-select v-model="form.category">
                <a-option value="design-change">设计变更</a-option>
                <a-option value="render-error">渲染异常</a-option>
                <a-option value="environment-noise">环境噪声</a-option>
              </a-select>
            </a-form-item>
            <a-form-item
              field="decision"
              label="审批结论"
              :rules="[{ required: true, message: '请选择审批结论' }]"
            >
              <a-radio-group v-model="form.decision" type="button">
                <a-radio value="approved">批准为新基线</a-radio>
                <a-radio value="rejected">驳回归</a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item
              field="reviewer"
              label="批准人"
              :rules="[{ required: true, message: '请填写批准人' }]"
            >
              <a-input v-model="form.reviewer" />
            </a-form-item>
            <a-form-item
              field="reason"
              label="审批原因"
              :rules="[
                { required: true, message: '请填写审批原因' },
                { minLength: 8, message: '审批原因至少 8 个字符' },
              ]"
            >
              <a-textarea
                v-model="form.reason"
                :auto-size="{ minRows: 4, maxRows: 7 }"
                placeholder="说明业务需求、设计稿或异常依据"
              />
            </a-form-item>
            <a-alert v-if="form.decision === 'approved'" type="warning" style="margin-bottom: 16px">
              批准前会再次核对规则版本 v{{ meta?.rulesVersion }} 与当前有效基线 {{ activeBaseline?.version ?? '—' }}；
              版本落后或并发提交只会留下冲突说明，不会覆盖新基线。
            </a-alert>
            <a-button
              html-type="submit"
              type="primary"
              long
              :loading="reviewMutation.isPending.value"
              :disabled="Boolean(run.lockedBatchId) || run.status === 'stale'"
            >
              确认{{ form.decision === 'approved' ? '批准并创建基线' : '驳回' }}
            </a-button>
          </a-form>
        </aside>
      </div>
    </template>
  </a-spin>
</template>
