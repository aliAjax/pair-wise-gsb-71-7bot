<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getBaselines, getProjects } from '@/api/http'

const projectId = ref('')
const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
const { data: baselines, isLoading } = useQuery({
  queryKey: ['baselines', projectId],
  queryFn: () => getBaselines(projectId.value || undefined),
})

const projectName = (id: string) => projects.value?.find((project) => project.id === id)?.name ?? id
</script>

<template>
  <section class="page-intro compact">
    <div>
      <h2>历史基线与批准证据</h2>
      <p>批准只新增版本、不覆盖旧版本；同一页面/设备/主题始终只有一条有效基线，每条证据固定规则版本与批准运行。</p>
    </div>
    <a-select v-model="projectId" allow-clear placeholder="全部项目" style="width: 220px">
      <a-option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</a-option>
    </a-select>
  </section>

  <div class="baseline-layout">
    <a-card class="table-panel" :bordered="false">
      <a-table :data="baselines" :loading="isLoading" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="项目 / 页面" :width="200">
            <template #cell="{ record }">
              <div class="primary-cell">
                <strong>{{ record.page }}</strong>
                <span>{{ projectName(record.projectId) }} · {{ record.device }}</span>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="基线版本" :width="170">
            <template #cell="{ record }"><code>{{ record.version }}</code></template>
          </a-table-column>
          <a-table-column title="规则版本" :width="90">
            <template #cell="{ record }"><a-tag size="small">v{{ record.rulesVersion ?? '-' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="批准人 / 原因" :width="260">
            <template #cell="{ record }">
              <div class="evidence-cell">
                <strong>{{ record.approvedBy }}</strong>
                <span class="sub-text">{{ record.reason }}</span>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="批准时间" :width="140">
            <template #cell="{ record }">{{ record.approvedAt.slice(0, 16).replace('T', ' ') }}</template>
          </a-table-column>
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }"><a-tag :color="record.active ? 'green' : 'gray'">{{ record.active ? '有效' : '已停用' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }"><router-link :to="`/runs/${record.runId}`">追溯运行</router-link></template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <aside class="history-panel">
      <div class="panel-title">
        <div><h3>基线变更时间线</h3><span>旧基线停用保留，仅展示最近批准记录</span></div>
      </div>
      <a-timeline>
        <a-timeline-item v-for="baseline in baselines?.slice(0, 6)" :key="baseline.id" :dot-color="baseline.active ? 'green' : 'gray'">
          <strong>{{ baseline.page }} · {{ baseline.version }}</strong>
          <p>{{ baseline.reason }}</p>
          <small>{{ baseline.approvedBy }} · 规则 v{{ baseline.rulesVersion ?? '-' }} · {{ baseline.approvedAt.slice(0, 16).replace('T', ' ') }}</small>
        </a-timeline-item>
      </a-timeline>
    </aside>
  </div>
</template>
