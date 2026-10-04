<script setup lang="ts">
import { ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Message, Modal } from '@arco-design/web-vue'
import { getBatches, getRuns, mergeRuns, setBatchLock } from '@/api/http'
import StatusTag from '@/components/StatusTag.vue'
import type { ReleaseBatch, ScreenshotRun } from '@/types'

const queryClient = useQueryClient()
const selectedKeys = ref<string[]>([])

const { data: runs, isLoading } = useQuery({
  queryKey: ['runs', { status: 'pending' }],
  queryFn: () => getRuns({ status: 'pending' }),
})

const { data: batches } = useQuery({
  queryKey: ['batches'],
  queryFn: getBatches,
})

const mergeMutation = useMutation({
  mutationFn: mergeRuns,
  onSuccess: async () => {
    Message.success('重复运行已合并，并保留每次执行来源')
    selectedKeys.value = []
    await queryClient.invalidateQueries({ queryKey: ['runs'] })
  },
  onError: (error: Error) => Message.error(error.message),
})

const lockMutation = useMutation({
  mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
    setBatchLock(id, locked, '发布负责人'),
  onSuccess: async (batch) => {
    Message.success(
      batch.locked
        ? `批次「${batch.name}」已锁定，将继续使用规则 v${batch.lockedRulesVersion} 的原证据`
        : `批次「${batch.name}」已解冻，后续规则变更会重算其待审批运行`,
    )
    await queryClient.invalidateQueries({ queryKey: ['batches'] })
    await queryClient.invalidateQueries({ queryKey: ['runs'] })
  },
  onError: (error: Error) => Message.error(error.message),
})

const confirmToggleLock = (batch: ReleaseBatch, locked: boolean) => {
  if (!locked) {
    Modal.warning({
      title: '解冻发布批次',
      content: `解冻「${batch.name}」后，忽略规则变更会重新失效并重算该批次的待审批运行。`,
      hideCancel: false,
      onOk: () => lockMutation.mutate({ id: batch.id, locked }),
    })
    return
  }
  lockMutation.mutate({ id: batch.id, locked })
}

const unignoredCount = (run: ScreenshotRun) =>
  run.regions.filter((region) => !region.ignored).length
</script>

<template>
  <section class="page-intro compact">
    <div>
      <h2>待审批队列</h2>
      <p>审批人不能直接覆盖基线；批准、驳回和忽略都必须留下可审计原因。</p>
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
      <strong>{{ runs?.length ?? 0 }}</strong>
    </div>
    <div>
      <span>高风险运行</span>
      <strong class="danger">{{ runs?.filter((run) => run.mismatchRate >= 5).length ?? 0 }}</strong>
    </div>
    <div>
      <span>规则变更后已重算</span>
      <strong>{{ runs?.filter((run) => run.recomputeReason).length ?? 0 }}</strong>
    </div>
    <div>
      <span>并发冲突提交</span>
      <strong class="danger">{{ runs?.reduce((sum, run) => sum + (run.conflicts?.length ?? 0), 0) ?? 0 }}</strong>
    </div>
  </div>

  <a-card class="table-panel" :bordered="false" style="margin-bottom: 16px">
    <template #title>发布冻结批次</template>
    <template #extra><span class="muted">锁定批次的待审批运行在规则变更后继续使用原证据</span></template>
    <div class="batch-list">
      <div v-for="batch in batches" :key="batch.id" class="batch-row">
        <div class="batch-main">
          <strong>{{ batch.name }}</strong>
          <span>{{ batch.build }}</span>
        </div>
        <span class="batch-meta">
          {{ batch.locked ? `锁定于 ${batch.lockedAt?.slice(0, 16).replace('T', ' ')} · ${batch.lockedBy}` : '未锁定' }}
        </span>
        <span class="batch-meta">{{ batch.locked ? `证据规则 v${batch.lockedRulesVersion}` : '跟随最新规则' }}</span>
        <a-switch
          :model-value="batch.locked"
          :loading="lockMutation.isPending.value"
          checked-text="锁定"
          unchecked-text="解冻"
          @change="(value: string | number | boolean) => confirmToggleLock(batch, Boolean(value))"
        />
      </div>
    </div>
  </a-card>

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
        <a-table-column title="优先队列" :width="260">
          <template #cell="{ record }">
            <div class="primary-cell">
              <router-link :to="`/runs/${record.id}`">{{ record.page }}</router-link>
              <span>{{ record.name }} · {{ record.id }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="风险" :width="130">
          <template #cell="{ record }">
            <a-tag :color="record.mismatchRate >= 5 ? 'red' : record.mismatchRate >= 2 ? 'orange' : 'gray'">
              {{ record.mismatchRate.toFixed(2) }}%
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="差异区域" :width="150">
          <template #cell="{ record }">{{ unignoredCount(record) }} 处待判定</template>
        </a-table-column>
        <a-table-column title="证据" :width="170">
          <template #cell="{ record }">
            <a-tag size="small">规则 v{{ record.rulesVersion }}</a-tag>
            <a-tag v-if="record.recomputeReason" size="small" color="orange" style="margin-top: 4px">已重算</a-tag>
          </template>
        </a-table-column>
        <a-table-column title="并发冲突" :width="100">
          <template #cell="{ record }">
            <a-tag v-if="record.conflicts?.length" color="red" size="small">{{ record.conflicts.length }} 次</a-tag>
            <span v-else class="muted">无</span>
          </template>
        </a-table-column>
        <a-table-column title="构建" data-index="build" :width="180" />
        <a-table-column title="提交时间" :width="150">
          <template #cell="{ record }">{{ record.capturedAt.slice(5, 16).replace('T', ' ') }}</template>
        </a-table-column>
        <a-table-column title="状态" :width="100">
          <template #cell="{ record }"><StatusTag :status="record.status" /></template>
        </a-table-column>
        <a-table-column title="操作" :width="100" fixed="right">
          <template #cell="{ record }"><router-link :to="`/runs/${record.id}`">开始评审</router-link></template>
        </a-table-column>
      </template>
    </a-table>
  </a-card>
</template>
