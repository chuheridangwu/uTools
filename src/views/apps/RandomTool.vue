<script setup lang="ts">
/**
 * 随机工具
 * 集合掷骰子、抛硬币、随机数与抽签(随机点名)于一体,
 * 抽签结果可去重滚动,适合做决定、分配任务或小游戏。
 */
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

const tab = ref<'dice' | 'coin' | 'number' | 'pick'>('dice')

/* ------------------------------ 骰子 ------------------------------ */
const dice = reactive({ count: 2, sides: 6, values: [1, 1] as number[], rolling: false })

function rollDice() {
  dice.values = Array.from({ length: Math.min(6, Math.max(1, dice.count)) }, () =>
    Math.floor(Math.random() * dice.sides) + 1,
  )
  dice.rolling = true
  window.setTimeout(() => (dice.rolling = false), 500)
}

const diceSum = computed(() => dice.values.reduce((a, b) => a + b, 0))

/* ------------------------------ 硬币 ------------------------------ */
const coin = reactive({ heads: 0, tails: 0, last: '', spinning: false })

function flipCoin() {
  coin.spinning = true
  const res = Math.random() < 0.5 ? '正面' : '反面'
  window.setTimeout(() => {
    coin.last = res
    if (res === '正面') coin.heads++
    else coin.tails++
    coin.spinning = false
  }, 500)
}

function resetCoin() {
  coin.heads = 0
  coin.tails = 0
  coin.last = ''
}

/* ------------------------------ 随机数 ------------------------------ */
const num = reactive({ min: 1, max: 100, count: 1, unique: false, result: [] as number[] })

function rollNumber() {
  const min = Math.min(num.min, num.max)
  const max = Math.max(num.min, num.max)
  const span = max - min + 1
  const count = Math.max(1, Math.min(100, num.count))
  if (num.unique && count > span) {
    ElMessage.warning('不重复模式下,个数不能超过范围大小')
    num.result = []
    return
  }
  const out: number[] = []
  if (num.unique) {
    const pool = new Set<number>()
    while (pool.size < count) pool.add(Math.floor(Math.random() * span) + min)
    out.push(...pool)
  } else {
    for (let i = 0; i < count; i++) out.push(Math.floor(Math.random() * span) + min)
  }
  num.result = out
}

/* ------------------------------ 抽签 ------------------------------ */
const pick = reactive({
  raw: '苹果\n香蕉\n橙子\n葡萄',
  result: '',
  exclude: false,
  history: [] as string[],
})

const pickItems = computed(() => pick.raw.split('\n').map((s) => s.trim()).filter(Boolean))

function doPick() {
  let pool = pickItems.value
  if (pick.exclude) pool = pool.filter((p) => !pick.history.includes(p))
  if (!pool.length) {
    ElMessage.info(pick.exclude ? '所有选项都已被抽过,已重置历史' : '请先输入候选项')
    if (pick.exclude) pick.history = []
    return
  }
  const idx = Math.floor(Math.random() * pool.length)
  const choice = pool[idx]
  pick.result = choice
  if (!pick.history.includes(choice)) pick.history.unshift(choice)
  pick.history = pick.history.slice(0, 20)
}

const DICE_FACE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function diceFace(v: number): string {
  return v >= 1 && v <= 6 ? DICE_FACE[v - 1] : '🎲'
}
</script>

<template>
  <div class="rt">
    <div class="head">
      <div>
        <h3 class="title">随机工具</h3>
        <p class="sub">掷骰子、抛硬币、随机数与抽签,让选择交给运气</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="dice">骰子</el-radio-button>
        <el-radio-button value="coin">硬币</el-radio-button>
        <el-radio-button value="number">随机数</el-radio-button>
        <el-radio-button value="pick">抽签</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 骰子 -->
    <div v-if="tab === 'dice'" class="pane">
      <div class="dice-row">
        <div v-for="(v, i) in dice.values" :key="i" class="die" :class="{ rolling: dice.rolling }">
          {{ diceFace(v) }}
        </div>
      </div>
      <div class="ctrl">
        <span class="lbl">数量</span>
        <el-input-number v-model="dice.count" :min="1" :max="6" @change="rollDice" />
        <span class="lbl">面数</span>
        <el-input-number v-model="dice.sides" :min="2" :max="100" @change="rollDice" />
        <el-button type="primary" @click="rollDice">掷骰子</el-button>
      </div>
      <div class="sum">点数合计:<b>{{ diceSum }}</b></div>
    </div>

    <!-- 硬币 -->
    <div v-else-if="tab === 'coin'" class="pane">
      <div class="coin" :class="{ spinning: coin.spinning }">
        {{ coin.spinning ? '🪙' : coin.last === '正面' ? '🌕' : coin.last === '反面' ? '🌑' : '🪙' }}
      </div>
      <div class="coin-result">{{ coin.spinning ? '抛掷中…' : coin.last || '点击下方按钮开始' }}</div>
      <div class="ctrl">
        <el-button type="primary" @click="flipCoin">抛硬币</el-button>
        <el-button @click="resetCoin">重置统计</el-button>
      </div>
      <div class="coin-stats">
        <span>正面 {{ coin.heads }} 次</span>
        <span>反面 {{ coin.tails }} 次</span>
        <span v-if="coin.heads + coin.tails">共 {{ coin.heads + coin.tails }} 次</span>
      </div>
    </div>

    <!-- 随机数 -->
    <div v-else-if="tab === 'number'" class="pane">
      <div class="ctrl">
        <span class="lbl">最小</span>
        <el-input-number v-model="num.min" />
        <span class="lbl">最大</span>
        <el-input-number v-model="num.max" />
        <span class="lbl">个数</span>
        <el-input-number v-model="num.count" :min="1" :max="100" />
        <el-checkbox v-model="num.unique">不重复</el-checkbox>
        <el-button type="primary" @click="rollNumber">生成</el-button>
      </div>
      <div class="numbers">
        <span v-for="(n, i) in num.result" :key="i" class="num-chip">{{ n }}</span>
        <span v-if="!num.result.length" class="empty">点击「生成」得到随机数</span>
      </div>
    </div>

    <!-- 抽签 -->
    <div v-else class="pane">
      <div class="cols">
        <div class="side">
          <div class="s-label">候选项(每行一个)</div>
          <el-input v-model="pick.raw" type="textarea" :rows="8" placeholder="每行一个候选项" />
          <el-checkbox v-model="pick.exclude" class="ex">抽过的不再重复</el-checkbox>
        </div>
        <div class="side">
          <div class="s-label">抽取结果</div>
          <div class="pick-box" :class="{ has: pick.result }">{{ pick.result || '🎯' }}</div>
          <el-button type="primary" @click="doPick">抽取</el-button>
        </div>
      </div>
      <div v-if="pick.history.length" class="history">
        <span class="h-l">历史:</span>
        <span v-for="(h, i) in pick.history" :key="i" class="h-chip">{{ h }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rt {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
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
.pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.dice-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
}
.die {
  width: 84px;
  height: 84px;
  border-radius: 16px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--card-border);
  display: grid;
  place-items: center;
  font-size: 56px;
  line-height: 1;
  color: #6366f1;
}
.die.rolling {
  animation: shake 0.5s;
}
@keyframes shake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-14deg) scale(1.05); }
  75% { transform: rotate(14deg) scale(1.05); }
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.sum {
  font-size: 15px;
  color: var(--el-text-color-regular);
}
.sum b {
  color: #6366f1;
  font-size: 20px;
  margin-left: 4px;
}
.coin {
  font-size: 90px;
  line-height: 1;
}
.coin.spinning {
  animation: flip 0.5s;
}
@keyframes flip {
  0% { transform: rotateY(0); }
  100% { transform: rotateY(720deg); }
}
.coin-result {
  font-size: 20px;
  font-weight: 700;
  color: #6366f1;
}
.coin-stats {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  min-height: 60px;
  align-items: center;
  max-width: 640px;
}
.num-chip {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 8px 18px;
  border-radius: 12px;
  background: color-mix(in srgb, #6366f1 12%, transparent);
  color: #6366f1;
}
.empty {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;
}
@media (max-width: 640px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.s-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ex {
  align-self: flex-start;
}
.pick-box {
  height: 120px;
  border: 1px dashed var(--card-border);
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 30px;
  color: var(--el-text-color-placeholder);
}
.pick-box.has {
  border-style: solid;
  border-color: #6366f1;
  color: #6366f1;
  font-weight: 700;
}
.history {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.h-l {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.h-chip {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}
</style>
