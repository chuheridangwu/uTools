<script setup lang="ts">
/**
 * JSON 树形查看节点(递归组件)
 * 支持折叠/展开、数组长度与对象键数徽标、值按类型配色。
 */
import { computed, ref } from 'vue'

const props = defineProps<{ name: string; value: unknown; depth?: number; initialOpen?: boolean }>()

/** 是否为可折叠节点(对象/数组) */
const isContainer = computed(() => {
  const v = props.value
  return typeof v === 'object' && v !== null
})

/** 值的展示文本(原始字面量) */
const literal = computed(() => {
  const v = props.value
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
})

/** 值类型用于配色 */
const kind = computed(() => {
  const v = props.value
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  return typeof v
})

const open = ref((props.depth ?? 0) < 1 || props.initialOpen)

function toggle() {
  open.value = !open.value
}

/** 容器徽标文本 */
const badge = computed(() => {
  const v = props.value
  if (Array.isArray(v)) return `[${v.length}]`
  if (isContainer.value) return `{${Object.keys(v as object).length}}`
  return ''
})
</script>

<template>
  <div class="jnode">
    <!-- 对象/数组:可折叠 -->
    <template v-if="isContainer">
      <div class="line" @click="toggle">
        <span class="arrow" :class="{ open }">▶</span>
        <span class="key">{{ name }}:</span>
        <span class="kind-tag">{{ Array.isArray(value) ? 'Array' : 'Object' }}</span>
        <span class="badge">{{ badge }}</span>
      </div>
      <template v-if="open">
        <JsonTreeNode
          v-for="(k, i) of Object.keys(value as object)"
          :key="i"
          :name="String(k)"
          :value="(value as Record<string, unknown>)[k]"
          :depth="(depth ?? 0) + 1"
        />
        <div class="line close">
          <span class="arrow empty" />
          <span class="key-caps" style="margin-left: 2px">{{ Array.isArray(value) ? ']' : '}' }}</span>
        </div>
      </template>
    </template>

    <!-- 基础值 -->
    <div v-else class="line">
      <span class="arrow empty" />
      <span class="key">{{ name }}:</span>
      <span class="val m" :class="kind">{{ literal }}</span>
    </div>
  </div>
</template>

<style scoped>
.jnode {
  padding-left: 14px;
  border-left: 1px dashed var(--el-border-color-light);
  font-family: 'JetBrains Mono', SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}
.line {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  cursor: pointer;
  border-radius: 4px;
  padding: 0 6px;
}
.line:hover {
  background: var(--el-fill-color-light);
}
.arrow {
  display: inline-block;
  width: 14px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  transition: transform 0.15s;
  transform: rotate(-90deg);
}
.arrow.open {
  transform: rotate(0);
}
.arrow.empty {
  visibility: hidden;
}
.key {
  color: var(--el-color-primary);
}
.kind-tag {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-light);
  padding: 0 4px;
  border-radius: 4px;
}
.badge {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.val.string {
  color: var(--el-color-success);
}
.val.number {
  color: #0ea5e9;
}
.val.boolean {
  color: #f59e0b;
}
.val.null,
.val.undefined {
  color: var(--el-text-color-secondary);
  font-style: italic;
}
.key-caps {
  color: var(--el-text-color-secondary);
}
</style>
