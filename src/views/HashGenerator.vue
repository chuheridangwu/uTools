<script setup lang="ts">
/**
 * 哈希生成器
 * MD5 / SHA-1 / SHA-256 / SHA-512 摘要计算 + HMAC-SHA256 加盐,基于 crypto-js。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import MD5 from 'crypto-js/md5'
import SHA1 from 'crypto-js/sha1'
import SHA256 from 'crypto-js/sha256'
import SHA512 from 'crypto-js/sha512'
import HmacSHA256 from 'crypto-js/hmac-sha256'
import ToolPage from '@/components/ToolPage.vue'
import { copyText, downloadText } from '@/utils/common'

const input = ref('')
const hmacKey = ref('')

const md5 = computed(() => input.value ? MD5(input.value).toString() : '')
const sha1 = computed(() => input.value ? SHA1(input.value).toString() : '')
const sha256 = computed(() => input.value ? SHA256(input.value).toString() : '')
const sha512 = computed(() => input.value ? SHA512(input.value).toString() : '')
const hmac = computed(() => (input.value && hmacKey.value ? HmacSHA256(input.value, hmacKey.value).toString() : ''))

const all = computed(() => [
  { name: 'MD5', value: md5.value },
  { name: 'SHA-1', value: sha1.value },
  { name: 'SHA-256', value: sha256.value },
  { name: 'SHA-512', value: sha512.value },
  ...(hmac.value ? [{ name: 'HMAC-SHA256', value: hmac.value }] : []),
])

function copyAll() {
  copyText(all.value.map((a) => `${a.name}: ${a.value}`).join('\n'))
  ElMessage.success('已复制全部摘要')
}

function downloadAll() {
  downloadText('hashes.txt', all.value.map((a) => `${a.name}: ${a.value}`).join('\n'))
}
</script>

<template>
  <ToolPage>
    <template #title>哈希生成器</template>
    <template #desc>一次输入得到 MD5、SHA-1/256/512 摘要与 HMAC-SHA256,本地计算,不用后端。</template>

    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>输入</span>
          <div>
            <el-button size="small" @click="copyAll">复制全部</el-button>
            <el-button size="small" @click="downloadAll">导出 TXT</el-button>
          </div>
        </div>
      </template>
      <el-input v-model="input" type="textarea" :rows="4" class="mono" placeholder="粘贴要计算摘要的文本…" />

      <div v-for="h in all" :key="h.name" class="row">
        <span class="hlabel" :class="{ hl: h.name === 'HMAC-SHA256' }">{{ h.name }}</span>
        <code class="mono hval">{{ h.value }}</code>
        <el-button size="small" text type="primary" @click="h.value && copyText(h.value)">复制</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="mt12">
      <template #header>HMAC 加盐(SHA-256)</template>
      <el-input v-model="hmacKey" size="small" placeholder="输入 HMAC 密钥(可选)" class="mono" style="max-width: 320px" />
    </el-card>
  </ToolPage>
</template>

<style scoped>
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px dashed var(--card-border);
}
.hlabel {
  width: 110px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-color-primary);
  flex-shrink: 0;
}
.hval {
  flex: 1;
  font-size: 12.5px;
  word-break: break-all;
  background: var(--el-fill-color-lighter);
  padding: 6px 10px;
  border-radius: 6px;
}
</style>
