<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Message } from '@arco-design/web-vue'
import { getMeta, getRuns, mergeRuns, recomputeRun } from '@/api/http'
import StatusTag from '@/components/StatusTag.vue'
import { conflictKindLabel } from '@/utils/approval'
import type { ScreenshotRun } from '@/types'

const queryClient = useQueryClient()
const selectedKeys = ref<string[]>([])

const { data: allRuns, isLoading } = useQuery({
  queryKey: ['runs', 'approval-queue'],
  queryFn: () => getRuns(),
})
const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: getMeta })

const runs = computed(() =>
  (allRuns.value ?? []).filter((run) => run.status === 'pending' || run.status === 'stale'),
)

const mergeMutation = useMutation({
  mutationFn: mergeRuns,
  onSuccess: async () => {
    Message.success('重复运行已合并，并保留每次执行来源')
    selectedKeys.value = []
    await queryClient.invalidateQueries({ queryKey: ['runs'] })
  },
  onError: (error: Error) => Message.error(error.message),
})

const recomputeMutation = useMutation({
  mutationFn: (id: string) => recomputeRun(id),
  onSuccess: async () => {
    Message.success('已按当前规则版本重算')
    await queryClient.invalidateQueries({ queryKey: ['runs'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  },
  onError: (error: Error) => Message.error(error.message),
})

const unignoredCount = (run: ScreenshotRun) =>
  run.regions.filter((region) => !region.ignored).length

const rulesBehind = (run: ScreenshotRun) => (run.rulesVersion ?? 0) < (meta.value?.rulesVersion ?? 0)
</script>

<template>
  <section class="page-intro compact">
    <div>
      <h2>待审批队列</h2>
      <p>冻结期内评审人与发布负责人可能同时提交；审批前核对规则版本与有效基线，落后方只留冲突说明。</p>
    </div>
    <a-space>
      <a-button :disabled="selectedKeys.length < 2" @click="mergeMutation.mutate(selectedKeys)">
        <icon-merge /> 合并重复运行
      </a-button>
      <a-button type="primary" :disabled="selectedKeys.length === 0" @click="selectedKeys = []">
        清除选择
      </a-button>
    </a-space>
  </section>

  <div class="queue-summary">
    <div>
      <span>当前待审批</span>
      <strong>{{ runs?.filter((run) => run.status === 'pending').length ?? 0 }}</strong>
    </div>
    <div>
      <span>规则失效待重算</span>
      <strong class="danger">{{ runs?.filter((run) => run.status === 'stale').length ?? 0 }}</strong>
    </div>
    <div>
      <span>冲突待处理</span>
      <strong class="danger">{{ runs?.filter((run) => Boolean(run.conflict)).length ?? 0 }}</strong>
    </div>
    <div>
      <span>当前规则版本</span>
      <strong>v{{ meta?.rulesVersion ?? '-' }}</strong>
    </div>
  </div>

  <a-card class="table-panel" :bordered="false">
    <a-table
      v-model:selected-keys="selectedKeys"
      :data="runs"
      :loading="isLoading"
      :pagination="false"
      row-key="id"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
    >
      <template #columns>
        <a-table-column title="优先队列" :width="230">
          <template #cell="{ record }">
            <div class="primary-cell">
              <router-link :to="`/runs/${record.id}`">{{ record.page }}</router-link>
              <span>{{ record.name }} · {{ record.id }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="风险" :width="100">
          <template #cell="{ record }">
            <a-tag :color="record.mismatchRate >= 5 ? 'red' : record.mismatchRate >= 2 ? 'orange' : 'gray'">
              {{ record.mismatchRate.toFixed(2) }}%
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="规则版本核对" :width="150">
          <template #cell="{ record }">
            <a-tag :color="rulesBehind(record) || record.status === 'stale' ? 'purple' : 'green'" size="small">
              v{{ record.rulesVersion ?? '-' }} / v{{ meta?.rulesVersion ?? '-' }}
            </a-tag>
            <div v-if="record.status === 'stale'" class="sub-text">失效待重算</div>
          </template>
        </a-table-column>
        <a-table-column title="有效基线核对" :width="160">
          <template #cell="{ record }">
            <code>{{ record.baselineVersion }}</code>
          </template>
        </a-table-column>
        <a-table-column title="差异区域" :width="110">
          <template #cell="{ record }">{{ unignoredCount(record) }} 处待判定</template>
        </a-table-column>
        <a-table-column title="状态" :width="120">
          <template #cell="{ record }"><StatusTag :status="record.status" /></template>
        </a-table-column>
        <a-table-column title="冲突说明" :width="200">
          <template #cell="{ record }">
            <div v-if="record.conflict" class="evidence-cell">
              <span class="conflict-line">{{ conflictKindLabel(record.conflict.kind) }}</span>
              <span class="sub-text">{{ record.conflict.message }}</span>
            </div>
            <span v-else class="sub-text">无</span>
          </template>
        </a-table-column>
        <a-table-column title="操作" :width="130" fixed="right">
          <template #cell="{ record }">
            <a-space direction="vertical" :size="2">
              <router-link :to="`/runs/${record.id}`">开始评审</router-link>
              <a-button
                v-if="record.status === 'stale'"
                type="text"
                size="mini"
                :loading="recomputeMutation.isPending.value"
                @click="recomputeMutation.mutate(record.id)"
              >
                立即重算
              </a-button>
            </a-space>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </a-card>
</template>
