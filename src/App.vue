<script setup>
import { RouterLink, RouterView } from "vue-router";
import { storeToRefs } from "pinia";
import { useUiStore } from "@/stores/ui";
import { useHealthData } from "@/composables/useHealthData";

const uiStore = useUiStore();
const { themeLabel, privacyLabel } = storeToRefs(uiStore);
uiStore.applyToDocument();

const { loading, error, source } = useHealthData();
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>健康可視化</h1>
      <div class="header-actions">
        <nav class="nav" aria-label="Primary">
          <RouterLink to="/overview">概要</RouterLink>
          <RouterLink to="/body">体組成</RouterLink>
          <RouterLink to="/nutrition">食事</RouterLink>
          <RouterLink to="/steps">歩数</RouterLink>
          <RouterLink to="/labs">検査結果</RouterLink>
        </nav>
        <div class="header-buttons">
          <button class="theme-toggle" type="button" @click="uiStore.togglePrivacy">
            {{ privacyLabel }}
          </button>
          <button class="theme-toggle" type="button" @click="uiStore.toggleTheme">
            {{ themeLabel }}
          </button>
        </div>
      </div>
    </header>
    <main>
      <p v-if="loading">読み込み中...</p>
      <template v-else>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="source === 'mock'" class="meta">サンプルデータを表示しています。</p>
        <RouterView />
      </template>
    </main>
  </div>
</template>
