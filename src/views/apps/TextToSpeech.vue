<script setup lang="ts">
/**
 * 文字转语音
 * 基于浏览器内置的 Web Speech API,把文字朗读出来;
 * 可选择声音、语速、音调与音量,支持暂停/继续/停止。
 */
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPause, VideoPlay, RefreshLeft, SwitchButton } from '@element-plus/icons-vue'

const text = ref('你好,这是一个文字转语音的小工具,可以调节语速和音调。')
const voices = ref<SpeechSynthesisVoice[]>([])
const supported = ref(true)

const cfg = reactive({
  voiceURI: '',
  rate: 1,
  pitch: 1,
  volume: 1,
})

const speaking = ref(false)
const paused = ref(false)

function loadVoices() {
  if (!('speechSynthesis' in window)) {
    supported.value = false
    return
  }
  voices.value = window.speechSynthesis.getVoices()
  if (!cfg.voiceURI && voices.value.length) {
    const zh = voices.value.find((v) => v.lang.startsWith('zh'))
    cfg.voiceURI = (zh || voices.value[0]).voiceURI
  }
}

function speak() {
  if (!supported.value) return
  if (!text.value.trim()) {
    ElMessage.warning('请输入要朗读的文字')
    return
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.value)
  const v = voices.value.find((x) => x.voiceURI === cfg.voiceURI)
  if (v) u.voice = v
  u.rate = cfg.rate
  u.pitch = cfg.pitch
  u.volume = cfg.volume
  u.onend = () => {
    speaking.value = false
    paused.value = false
  }
  u.onerror = () => {
    speaking.value = false
    paused.value = false
  }
  window.speechSynthesis.speak(u)
  speaking.value = true
  paused.value = false
}

function pauseOrResume() {
  if (!speaking.value) return
  if (paused.value) {
    window.speechSynthesis.resume()
    paused.value = false
  } else {
    window.speechSynthesis.pause()
    paused.value = true
  }
}

function stop() {
  window.speechSynthesis.cancel()
  speaking.value = false
  paused.value = false
}

onMounted(() => {
  loadVoices()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})
</script>

<template>
  <div class="tts">
    <div class="head">
      <div>
        <h3 class="title">文字转语音</h3>
        <p class="sub">使用系统内置语音朗读文字,支持调节语速、音调与音量</p>
      </div>
    </div>

    <div v-if="!supported" class="unsupported">当前浏览器不支持语音合成(Web Speech API)</div>

    <template v-else>
      <el-input v-model="text" type="textarea" :rows="6" placeholder="输入要朗读的文字…" resize="vertical" />

      <div class="cfg">
        <div class="row">
          <span class="label">声音</span>
          <el-select v-model="cfg.voiceURI" filterable style="flex: 1">
            <el-option
              v-for="v in voices"
              :key="v.voiceURI"
              :value="v.voiceURI"
              :label="`${v.name} (${v.lang})`"
            />
          </el-select>
        </div>
        <div class="row">
          <span class="label">语速</span>
          <el-slider v-model="cfg.rate" :min="0.5" :max="2" :step="0.1" />
          <span class="val">{{ cfg.rate.toFixed(1) }}x</span>
        </div>
        <div class="row">
          <span class="label">音调</span>
          <el-slider v-model="cfg.pitch" :min="0" :max="2" :step="0.1" />
          <span class="val">{{ cfg.pitch.toFixed(1) }}</span>
        </div>
        <div class="row">
          <span class="label">音量</span>
          <el-slider v-model="cfg.volume" :min="0" :max="1" :step="0.1" />
          <span class="val">{{ Math.round(cfg.volume * 100) }}%</span>
        </div>
      </div>

      <div class="acts">
        <el-button type="primary" size="large" :icon="VideoPlay" @click="speak">开始朗读</el-button>
        <el-button size="large" :icon="VideoPause" :disabled="!speaking" @click="pauseOrResume">
          {{ paused ? '继续' : '暂停' }}
        </el-button>
        <el-button size="large" :icon="SwitchButton" :disabled="!speaking" @click="stop">停止</el-button>
        <el-button size="large" :icon="RefreshLeft" @click="text = ''">清空</el-button>
      </div>

      <p class="foot">提示:可用语音与语言取决于操作系统与浏览器;部分环境需要用户先与页面交互才能播放。</p>
    </template>
  </div>
</template>

<style scoped>
.tts {
  padding: 4px 2px;
}
.head {
  margin-bottom: 14px;
}
.title {
  margin: 0;
  font-size: 16px;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.unsupported {
  padding: 40px;
  text-align: center;
  color: #ef4444;
  font-size: 14px;
}
.cfg {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.label {
  width: 48px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.row :deep(.el-slider) {
  flex: 1;
}
.val {
  width: 48px;
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  flex: none;
}
.acts {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
