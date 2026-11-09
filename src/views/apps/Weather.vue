<script setup lang="ts">
/**
 * 天气查询
 * 基于 open-meteo 的免费接口(无需密钥),支持城市搜索与定位,
 * 展示当前天气与未来 7 天预报,数据仅供参考。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { Location, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Place {
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

const WEATHER: Record<number, { text: string; icon: string }> = {
  0: { text: '晴', icon: '☀️' }, 1: { text: '大部晴朗', icon: '🌤️' }, 2: { text: '多云', icon: '⛅' }, 3: { text: '阴', icon: '☁️' },
  45: { text: '雾', icon: '🌫️' }, 48: { text: '雾凇', icon: '🌫️' },
  51: { text: '毛毛雨', icon: '🌦️' }, 53: { text: '毛毛雨', icon: '🌦️' }, 55: { text: '毛毛雨', icon: '🌦️' },
  61: { text: '小雨', icon: '🌧️' }, 63: { text: '中雨', icon: '🌧️' }, 65: { text: '大雨', icon: '🌧️' },
  66: { text: '冻雨', icon: '🌧️' }, 67: { text: '冻雨', icon: '🌧️' },
  71: { text: '小雪', icon: '🌨️' }, 73: { text: '中雪', icon: '🌨️' }, 75: { text: '大雪', icon: '❄️' }, 77: { text: '雪粒', icon: '🌨️' },
  80: { text: '阵雨', icon: '🌦️' }, 81: { text: '阵雨', icon: '🌦️' }, 82: { text: '强阵雨', icon: '⛈️' },
  85: { text: '阵雪', icon: '🌨️' }, 86: { text: '阵雪', icon: '🌨️' },
  95: { text: '雷阵雨', icon: '⛈️' }, 96: { text: '雷阵雨伴冰雹', icon: '⛈️' }, 99: { text: '雷阵雨伴冰雹', icon: '⛈️' },
}

const keyword = ref('北京')
const results = reactive<{ list: Place[] }>({ list: [] })
const place = ref<Place | null>(null)
const loading = ref(false)
const current = reactive<{ temp: number; code: number; wind: number; humidity: number; feels: number }>({
  temp: 0, code: 0, wind: 0, humidity: 0, feels: 0,
})
const daily = ref<{ date: string; code: number; max: number; min: number }[]>([])

const curWeather = computed(() => WEATHER[current.code] || { text: '未知', icon: '❓' })

function wmo(code: number) {
  return WEATHER[code] || { text: '未知', icon: '❓' }
}

function weekday(date: string): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(date).getDay()]
}

async function search() {
  if (!keyword.value.trim()) return
  loading.value = true
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(keyword.value.trim())}&count=6&language=zh&format=json`,
    )
    const data = await res.json()
    results.list = data.results || []
    if (!results.list.length) ElMessage.warning('未找到该城市')
  } catch {
    ElMessage.error('搜索失败,请检查网络')
  } finally {
    loading.value = false
  }
}

async function loadWeather(p: Place) {
  place.value = p
  results.list = []
  loading.value = true
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`
    const res = await fetch(url)
    const data = await res.json()
    current.temp = Math.round(data.current.temperature_2m)
    current.feels = Math.round(data.current.apparent_temperature)
    current.humidity = data.current.relative_humidity_2m
    current.wind = data.current.wind_speed_10m
    current.code = data.current.weather_code
    daily.value = data.daily.time.map((t: string, i: number) => ({
      date: t,
      code: data.daily.weather_code[i],
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
    }))
  } catch {
    ElMessage.error('天气获取失败,请检查网络')
  } finally {
    loading.value = false
  }
}

async function locate() {
  if (!navigator.geolocation) {
    ElMessage.info('当前环境不支持定位,请手动搜索城市')
    return
  }
  loading.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      void loadWeather({ name: '我的位置', latitude: pos.coords.latitude, longitude: pos.coords.longitude })
    },
    () => {
      loading.value = false
      ElMessage.warning('定位失败,请手动搜索城市')
    },
  )
}

onMounted(() => search())
</script>

<template>
  <div class="wx">
    <div class="head">
      <div>
        <h3 class="title">天气查询</h3>
        <p class="sub">数据来自 open-meteo,无需密钥,仅供参考</p>
      </div>
      <div class="search">
        <el-input v-model="keyword" placeholder="搜索城市" size="default" style="width: 160px" @keydown.enter="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button :loading="loading" @click="search">搜索</el-button>
        <el-button :icon="Location" @click="locate">定位</el-button>
      </div>
    </div>

    <div v-if="results.list.length" class="results">
      <div v-for="(r, i) in results.list" :key="i" class="r-item" @click="loadWeather(r)">
        <span class="r-name">{{ r.name }}</span>
        <span class="r-sub">{{ [r.admin1, r.country].filter(Boolean).join(' · ') }}</span>
      </div>
    </div>

    <div v-if="place" class="now">
      <div class="now-left">
        <div class="now-place">{{ place.name }}</div>
        <div class="now-temp">{{ current.temp }}<small>°C</small></div>
        <div class="now-text">{{ curWeather.icon }} {{ curWeather.text }} · 体感 {{ current.feels }}°</div>
      </div>
      <div class="now-icon">{{ curWeather.icon }}</div>
      <div class="now-meta">
        <div class="meta"><span>湿度</span><b>{{ current.humidity }}%</b></div>
        <div class="meta"><span>风速</span><b>{{ current.wind }} km/h</b></div>
      </div>
    </div>

    <div v-if="daily.length" class="forecast">
      <div v-for="d in daily" :key="d.date" class="fc-day">
        <div class="fc-wd">{{ weekday(d.date) }}</div>
        <div class="fc-icon">{{ wmo(d.code).icon }}</div>
        <div class="fc-temp"><b>{{ d.max }}°</b><span>{{ d.min }}°</span></div>
        <div class="fc-text">{{ wmo(d.code).text }}</div>
      </div>
    </div>

    <div v-if="!place && !loading" class="empty">搜索并选择一个城市,查看实时天气与 7 天预报</div>
  </div>
</template>

<style scoped>
.wx {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
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
.search {
  display: flex;
  gap: 8px;
}
.results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.r-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
}
.r-item:hover {
  border-color: var(--el-color-primary);
}
.r-name {
  font-size: 14px;
  font-weight: 600;
}
.r-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.now {
  display: flex;
  align-items: center;
  gap: 20px;
  border-radius: 16px;
  padding: 22px 24px;
  background: linear-gradient(120deg, #0ea5e9, #6366f1);
  color: #fff;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.now-place {
  font-size: 15px;
  opacity: 0.9;
}
.now-temp {
  font-size: 56px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.now-temp small {
  font-size: 20px;
  font-weight: 400;
}
.now-text {
  font-size: 14px;
  opacity: 0.95;
}
.now-icon {
  font-size: 64px;
  margin-left: auto;
}
.now-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.meta {
  display: flex;
  gap: 10px;
  font-size: 13px;
  opacity: 0.95;
}
.meta b {
  font-weight: 700;
}
.forecast {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
}
@media (max-width: 720px) {
  .forecast {
    grid-template-columns: repeat(4, 1fr);
  }
}
.fc-day {
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px 6px;
  text-align: center;
}
.fc-wd {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.fc-icon {
  font-size: 26px;
  margin: 8px 0;
}
.fc-temp {
  font-size: 13px;
  display: flex;
  justify-content: center;
  gap: 6px;
}
.fc-temp b {
  font-weight: 700;
}
.fc-temp span {
  color: var(--el-text-color-secondary);
}
.fc-text {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}
.empty {
  text-align: center;
  padding: 50px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
