<script setup lang="ts">
/**
 * 表情符号
 * 常用 Emoji 分类浏览,点击即复制;支持关键字搜索与最近使用记录,
 * 全部内置,无需联网。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { copyText } from '@/utils/common'

interface Group {
  name: string
  emojis: string[]
}

const GROUPS: Group[] = [
  {
    name: '笑脸',
    emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾'.split(' '),
  },
  {
    name: '手势',
    emojis: '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤟 💪 🦾 🖕 ✍️ 💅 🤳'.split(' '),
  },
  {
    name: '人物',
    emojis: '👶 🧒 👦 👧 🧑 👨 👩 🧔 👱 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 💃 🕺 👯 🧖 🧗 🏃 🚶 💃'.split(' '),
  },
  {
    name: '动物',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦀 🦐 🦞 🦀 🐠 🐟 🐡 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦏 🐪 🐫 🦒 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦔'.split(' '),
  },
  {
    name: '食物',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🌮 🌯 🥗 🥘 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾'.split(' '),
  },
  {
    name: '活动',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🥅 🏒 🏑 🥍 🏏 ⛳ 🏹 🎣 🥊 🥋 🎽 ⛸️ 🥌 🛷 🎿 ⛷️ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎯 🎳 🎮 🎰 🧩'.split(' '),
  },
  {
    name: '物品',
    emojis: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🎙️ ⏰ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 🛢️ 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 ⛓️ 🧲 🔫 💣 🧨 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 💊 💉 🩸 🩹 🩺 🌡️ 🪑 🚽 🚰 🚿 🛁 🧴 🧷 🧹 🧺 🧻 🧼 🪒 🧽 🧯 🛒 🚪 🛏️ 🖼️ 🛍️ 🎁 🎈 🎏 🎀 🎊 🎉 🎎 🏮 🔑 🗝️ 🔐 🔒 🔓'.split(' '),
  },
  {
    name: '符号',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🈳 🈂️'.split(' '),
  },
]

const activeGroup = ref(0)
const kw = ref('')
const recent = ref<string[]>([])

const KEY = 'utools_emoji_recent'

const shown = computed(() => {
  if (kw.value.trim()) {
    const q = kw.value.trim()
    const all = GROUPS.flatMap((g) => g.emojis)
    // 简单匹配:按 Unicode 名称不易做,这里按分组中文名 + 返回全部匹配组
    const matchedGroups = GROUPS.filter((g) => g.name.includes(q))
    if (matchedGroups.length) return [...new Set(matchedGroups.flatMap((g) => g.emojis))]
    return all.filter((e) => e.includes(q))
  }
  return GROUPS[activeGroup.value].emojis
})

async function copy(e: string) {
  await copyText(e)
  recent.value = [e, ...recent.value.filter((x) => x !== e)].slice(0, 24)
  localStorage.setItem(KEY, JSON.stringify(recent.value))
  ElMessage.success(`已复制 ${e}`)
}

try {
  recent.value = JSON.parse(localStorage.getItem(KEY) || '[]')
} catch {
  recent.value = []
}
</script>

<template>
  <div class="em">
    <div class="head">
      <div>
        <h3 class="title">表情符号</h3>
        <p class="sub">点击任意表情即可复制,支持搜索与最近使用</p>
      </div>
      <el-input v-model="kw" placeholder="搜索分类,如「食物」" clearable size="default" style="width: 180px" />
    </div>

    <div v-if="recent.length && !kw" class="recent">
      <span class="r-label">最近</span>
      <button v-for="(e, i) in recent" :key="i" class="emoji" @click="copy(e)">{{ e }}</button>
    </div>

    <div v-if="!kw" class="tabs">
      <button v-for="(g, i) in GROUPS" :key="g.name" class="tab" :class="{ on: activeGroup === i }" @click="activeGroup = i">
        {{ g.name }}
      </button>
    </div>

    <div class="grid">
      <button v-for="(e, i) in shown" :key="i" class="emoji big" @click="copy(e)">{{ e }}</button>
      <div v-if="!shown.length" class="empty">没有匹配的表情</div>
    </div>
  </div>
</template>

<style scoped>
.em {
  padding: 4px 2px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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
.recent {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--card-border);
}
.r-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 6px;
}
.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tab {
  border: 1px solid var(--card-border);
  background: var(--el-fill-color-light);
  border-radius: 14px;
  padding: 4px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}
.tab.on {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
  gap: 6px;
}
.emoji {
  border: 1px solid transparent;
  background: transparent;
  border-radius: 10px;
  padding: 4px;
  font-size: 22px;
  cursor: pointer;
  transition: background 0.12s, transform 0.12s;
  line-height: 1;
}
.emoji.big {
  font-size: 26px;
  padding: 8px 0;
}
.emoji:hover {
  background: var(--el-fill-color-light);
  transform: scale(1.15);
}
.empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
