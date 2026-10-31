<script setup>
import { computed } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { storeToRefs } from "pinia";
import { useUiStore } from "@/stores/ui";
import { useHealthData } from "@/composables/useHealthData";
import { useAppShellViewModel } from "@/features/app/useAppShellViewModel";

const uiStore = useUiStore();
const { themeLabel, privacyLabel } = storeToRefs(uiStore);
uiStore.applyToDocument();

const { error, source } = useHealthData();
const {
  healthStore,
  hasGoogleClientId,
  authError,
  initialLoading,
  showLoginGate,
  showShareExpired,
  googleScriptError,
  googleButtonRoot,
  idToken,
  logout,
} = useAppShellViewModel();

const shareExpiresLabel = computed(() => {
  if (!healthStore.shareExpiresAt) {
    return "";
  }
  const date = new Date(healthStore.shareExpiresAt);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
});
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
          <button v-if="idToken" class="theme-toggle" type="button" @click="logout">
            ログアウト
          </button>
        </div>
      </div>
    </header>
    <main>
      <p v-if="initialLoading">読み込み中...</p>
      <section v-else-if="showShareExpired" class="table-wrap auth-gate">
        <h2 class="section-title">閲覧用リンクの有効期限が切れています</h2>
        <p class="meta">
          このリンクは発行から30分間だけ有効です。発行者に再発行を依頼してください。
        </p>
        <p v-if="healthStore.error" class="error">{{ healthStore.error }}</p>
      </section>
      <section v-else-if="showLoginGate" class="table-wrap auth-gate">
        <h2 class="section-title">Googleログインが必要です</h2>
        <p class="meta">許可されたアカウントでサインインしてください。</p>
        <p v-if="authError" class="error">
          認証エラーが発生しました。別アカウントで再ログインしてください。({{ healthStore.error }})
        </p>
        <p v-if="googleScriptError" class="error">
          Googleログインスクリプトの読み込みに失敗しました。広告ブロック等を解除して再読み込みしてください。
        </p>
        <div ref="googleButtonRoot" class="google-login-button"></div>
        <p v-if="!hasGoogleClientId" class="error">
          VITE_GOOGLE_CLIENT_ID が未設定です。
        </p>
      </section>
      <template v-else>
        <p v-if="healthStore.shareMode" class="meta">
          医師向け閲覧リンクで表示中です<template v-if="shareExpiresLabel">（{{ shareExpiresLabel }} まで有効）</template>。数値はそのまま表示されます。
        </p>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="source === 'mock'" class="meta">サンプルデータを表示しています。</p>
        <RouterView />
      </template>
    </main>
  </div>
</template>
