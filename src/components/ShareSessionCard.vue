<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { useHealthStore } from "@/stores/health";
import { buildShareUrl, formatShareRemaining, shareSecondsLeft } from "@/domain/share";

const store = useHealthStore();

const busy = ref(false);
const actionError = ref("");
const copied = ref(false);
const qrDataUrl = ref("");
const nowMs = ref(Date.now());
let timer = null;

const issued = computed(() => store.issuedShare);
const shareUrl = computed(() => {
  if (!issued.value) {
    return "";
  }
  const base = `${window.location.origin}${import.meta.env.BASE_URL}overview`;
  return buildShareUrl(base, issued.value.token);
});
const secondsLeft = computed(() =>
  issued.value ? shareSecondsLeft(issued.value.expiresAt, nowMs.value) : null,
);
const remainingLabel = computed(() => formatShareRemaining(secondsLeft.value));
const expiresLabel = computed(() => {
  if (!issued.value) {
    return "";
  }
  const date = new Date(issued.value.expiresAt);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
});

async function updateQr() {
  if (!shareUrl.value) {
    qrDataUrl.value = "";
    return;
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, { width: 220, margin: 1 });
  } catch {
    qrDataUrl.value = "";
  }
}

watch(shareUrl, updateQr);

async function issue() {
  busy.value = true;
  actionError.value = "";
  copied.value = false;
  try {
    await store.issueShare();
  } catch (error) {
    actionError.value = error?.message ?? "発行に失敗しました";
  } finally {
    busy.value = false;
  }
}

async function revoke() {
  busy.value = true;
  actionError.value = "";
  try {
    await store.revokeShare();
  } catch (error) {
    actionError.value = error?.message ?? "無効化に失敗しました";
  } finally {
    busy.value = false;
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now();
  }, 20000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<template>
  <section class="chart-card" style="margin-top: 16px">
    <h2 class="section-title">医師向け一時閲覧リンク</h2>
    <p class="meta">
      ログイン不要で30分間だけデータを閲覧できるURLを発行します。新しいURLを発行すると、前のURLは無効になります。この画面を閉じると発行したURLは再表示できません。
    </p>
    <p v-if="actionError" class="error">{{ actionError }}</p>

    <template v-if="issued">
      <p>
        <strong>{{ remainingLabel }}</strong>
        <span class="meta">（{{ expiresLabel }} まで有効）</span>
      </p>
      <p v-if="secondsLeft > 0">
        <input
          class="share-url-input"
          type="text"
          readonly
          :value="shareUrl"
          aria-label="閲覧用URL"
          @focus="(e) => e.target.select()"
        >
        <button class="theme-toggle" type="button" @click="copyUrl">
          {{ copied ? "コピーしました" : "URLをコピー" }}
        </button>
      </p>
      <p v-if="qrDataUrl && secondsLeft > 0">
        <img :src="qrDataUrl" alt="閲覧用URLのQRコード" width="220" height="220">
      </p>
      <p>
        <button class="theme-toggle" type="button" :disabled="busy" @click="issue">
          新しいURLを発行し直す
        </button>
        <button class="theme-toggle" type="button" :disabled="busy" @click="revoke">
          今すぐ無効化する
        </button>
      </p>
    </template>
    <p v-else>
      <button class="theme-toggle" type="button" :disabled="busy" @click="issue">
        30分間有効な閲覧用URLを発行
      </button>
    </p>
  </section>
</template>

<style scoped>
.share-url-input {
  width: min(560px, 100%);
  padding: 6px 10px;
  margin-right: 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
</style>
