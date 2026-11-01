<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { useHealthStore } from "@/stores/health";
import { buildShareUrl, formatShareExpiry, formatShareRemaining, shareSecondsLeft } from "@/domain/share";

const store = useHealthStore();

const busy = ref(false);
const busyAction = ref("");
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
const expiresLabel = computed(() =>
  issued.value ? formatShareExpiry(issued.value.expiresAt) : "",
);

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
  busyAction.value = "issue";
  actionError.value = "";
  copied.value = false;
  try {
    await store.issueShare();
  } catch (error) {
    actionError.value = error?.message ?? "発行に失敗しました";
  } finally {
    busy.value = false;
    busyAction.value = "";
  }
}

async function revoke() {
  busy.value = true;
  busyAction.value = "revoke";
  actionError.value = "";
  try {
    await store.revokeShare();
  } catch (error) {
    actionError.value = error?.message ?? "無効化に失敗しました";
  } finally {
    busy.value = false;
    busyAction.value = "";
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
  <section class="chart-card" style="margin-top: 16px" :aria-busy="busy">
    <h2 class="section-title">医師向け一時閲覧リンク</h2>
    <p class="meta">
      ログイン不要で1か月間データを閲覧できるURLを発行します。新しいURLを発行すると、前のURLは無効になります。この画面を閉じると発行したURLは再表示できません。
    </p>
    <p v-if="busy" class="meta busy-note" role="status">
      <span class="spinner" aria-hidden="true" />サーバーと通信しています…
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
          :disabled="busy"
          :value="shareUrl"
          aria-label="閲覧用URL"
          @focus="(e) => e.target.select()"
        >
        <button class="theme-toggle" type="button" :disabled="busy" @click="copyUrl">
          {{ copied ? "コピーしました" : "URLをコピー" }}
        </button>
      </p>
      <p v-if="qrDataUrl && secondsLeft > 0" :style="busy ? { opacity: 0.4 } : {}">
        <img :src="qrDataUrl" alt="閲覧用URLのQRコード" width="220" height="220">
      </p>
      <p>
        <button class="theme-toggle" type="button" :disabled="busy" @click="issue">
          <span v-if="busyAction === 'issue'" class="spinner" aria-hidden="true" />{{ busyAction === "issue" ? "発行中…" : "新しいURLを発行し直す" }}
        </button>
        <button class="theme-toggle" type="button" :disabled="busy" @click="revoke">
          <span v-if="busyAction === 'revoke'" class="spinner" aria-hidden="true" />{{ busyAction === "revoke" ? "無効化中…" : "今すぐ無効化する" }}
        </button>
      </p>
    </template>
    <p v-else>
      <button class="theme-toggle" type="button" :disabled="busy" @click="issue">
        <span v-if="busyAction === 'issue'" class="spinner" aria-hidden="true" />{{ busyAction === "issue" ? "発行中…" : "1か月間有効な閲覧用URLを発行" }}
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

.share-url-input:disabled {
  opacity: 0.5;
}

button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  vertical-align: -2px;
  animation: share-spin 0.8s linear infinite;
}

.busy-note .spinner {
  margin-right: 8px;
}

@keyframes share-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
