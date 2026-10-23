<script setup lang="ts">
/**
 * 工具页通用壳:标题 + 功能开关/操作区 + 正文
 * 统一页头观感,减少重复代码。
 */
</script>

<template>
  <div class="tool-page">
    <header class="thead">
      <h2 class="ttitle"><slot name="title" /></h2>
      <p class="tdesc"><slot name="desc" /></p>
    </header>
    <div class="tbody"><slot /></div>
  </div>
</template>

<style scoped>
.thead {
  margin-bottom: 18px;
}
.ttitle {
  margin: 0 0 6px;
  font-size: 20px;
}
.tdesc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}
</style>
