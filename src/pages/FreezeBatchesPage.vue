<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Message } from '@arco-design/web-vue'
import { getBatches, getProjects, getRuns, lockBatch } from '@/api/http'
import { formatTime, roleLabel } from '@/utils/approval'

const queryClient = useQueryClient()
const selectedKeys = ref<string[]>([])
const modalVisible = ref(false)
const form = reactive({ name: '', build: '', lockedBy: '高岑（发布负责人）' })

const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
const { data: runs } = useQuery({ queryKey: ['runs', 'freeze'], queryFn: () => getRuns() })
const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: getBatches })

// 只有已批准、带历史基线证据且尚未锁定的运行才能进入冻结批次
const lockableRuns = computed(() =>
  (runs.value ?? []).filter((run) => run.status === 'approved' && run.baselineId && !run.lockedBatchId),
)

const projectName = (id: string) => projects.value?.find((project) => project.id === id)?.name ?? id

const lockMutation = useMutation({
  mutationFn: lockBatch,
  onSuccess: async (batch) => {
    Message.success(`批次「${batch.name}」已锁定，${batch.evidence.length} 条运行的原证据已固化`)
    modalVisible.value = false
    selectedKeys.value = []
    Object.assign(form, { name: '', build: '', lockedBy: '高岑（发布负责人）' })
    await queryClient.invalidateQueries({ queryKey: ['batches'] })
    await queryClient.invalidateQueries({ queryKey: ['runs'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  },
  onError: (error: Error) => Message.error(error.message),
})

const submitLock = () => {
  if (!form.name.trim() || !form.build.trim()) {
    Message.warning('请填写批次名称和构建版本')
    return
  }
  lockMutation.mutate({
    name: form.name,
    build: form.build,
    lockedBy: form.lockedBy,
    runIds: selectedKeys.value,
  })
}
</script>

<template>
  <section class="page-intro compact">
    <div>
      <h2>发布冻结批次</h2>
      <p>批次锁定时把每条运行的审批结论、规则版本与历史基线固化为原证据；冻结期内规则变化也不重算、不改证据。</p>
    </div>
    <a-button type="primary" :disabled="selectedKeys.length === 0" @click="modalVisible = true">
      <icon-lock /> 锁定选中运行到批次
    </a-button>
  </section>

  <a-card class="table-panel" :bordered="false" style="margin-bottom: 16px">
    <template #title>可锁定的已批准运行</template>
    <template #extra><span class="muted">必须带历史基线依据</span></template>
    <a-table
      v-model:selected-keys="selectedKeys"
      :data="lockableRuns"
      :pagination="false"
      row-key="id"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
    >
      <template #columns>
        <a-table-column title="运行" :width="220">
          <template #cell="{ record }">
            <div class="primary-cell">
              <router-link :to="`/runs/${record.id}`">{{ record.name }}</router-link>
              <span>{{ record.id }} · {{ projectName(record.projectId) }}</span>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="构建" data-index="build" :width="170" />
        <a-table-column title="规则版本依据" :width="120">
          <template #cell="{ record }"><a-tag size="small">v{{ record.review?.rulesVersion }}</a-tag></template>
        </a-table-column>
        <a-table-column title="历史基线依据" :width="180">
          <template #cell="{ record }"><code>{{ record.review?.baselineVersion }}</code></template>
        </a-table-column>
        <a-table-column title="批准人" :width="160">
          <template #cell="{ record }">
            {{ record.review?.reviewer }}（{{ record.review ? roleLabel(record.review.role) : '' }}）
          </template>
        </a-table-column>
      </template>
    </a-table>
  </a-card>

  <a-card class="table-panel" :bordered="false">
    <template #title>已锁定冻结批次</template>
    <template #extra><span class="muted">批次内运行继续使用原证据</span></template>
    <a-empty v-if="!batches?.length" description="尚无锁定批次" />
    <div v-for="batch in batches" :key="batch.id" class="batch-evidence" style="background: #fff; border: 1px solid #e5e6eb">
      <div class="primary-cell" style="margin-bottom: 6px">
        <strong>{{ batch.name }} <a-tag color="arcoblue" size="small">冻结中</a-tag></strong>
        <span>{{ batch.id }} · {{ batch.build }} · {{ batch.lockedBy }} · {{ formatTime(batch.lockedAt) }}</span>
      </div>
      <a-table :data="batch.evidence" :pagination="false" row-key="runId" size="small">
        <template #columns>
          <a-table-column title="运行" data-index="runName" :width="200" />
          <a-table-column title="历史基线" :width="170">
            <template #cell="{ record }"><code>{{ record.baselineVersion }}</code></template>
          </a-table-column>
          <a-table-column title="规则版本" :width="90">
            <template #cell="{ record }">v{{ record.rulesVersion }}</template>
          </a-table-column>
          <a-table-column title="批准人" data-index="approvedBy" :width="100" />
          <a-table-column title="批准时间" :width="140">
            <template #cell="{ record }">{{ formatTime(record.approvedAt) }}</template>
          </a-table-column>
          <a-table-column title="原因" data-index="reason" />
        </template>
      </a-table>
    </div>
  </a-card>

  <a-modal
    v-model:visible="modalVisible"
    title="锁定发布冻结批次"
    :ok-loading="lockMutation.isPending.value"
    ok-text="确认锁定并固化证据"
    @ok="submitLock"
  >
    <a-alert type="warning" style="margin-bottom: 16px">
      将固化 {{ selectedKeys.length }} 条运行的审批结论、规则版本和历史基线；锁定后不可重复审批或重算。
    </a-alert>
    <a-form :model="form" layout="vertical">
      <a-form-item label="批次名称" required>
        <a-input v-model="form.name" placeholder="例如：6.18.0 发布冻结批次 RC2" />
      </a-form-item>
      <a-form-item label="构建版本" required>
        <a-input v-model="form.build" placeholder="release/6.18.0" />
      </a-form-item>
      <a-form-item label="锁定操作人" required>
        <a-input v-model="form.lockedBy" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
