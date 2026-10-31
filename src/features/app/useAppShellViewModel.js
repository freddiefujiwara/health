import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useHealthStore } from "@/stores/health";

const ID_TOKEN_STORAGE_KEY = "health-google-id-token";

/**
 * Manage the Google sign-in gate for the app shell (same scheme as asset).
 * Theme and privacy stay in the UI store.
 */
export function useAppShellViewModel() {
  const idToken = ref("");
  const googleReady = ref(false);
  const googleScriptError = ref(false);
  const googleButtonRoot = ref(null);

  const healthStore = useHealthStore();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const hasGoogleClientId = computed(() => Boolean(googleClientId));
  const authError = computed(() => healthStore.error.startsWith("AUTH "));
  const hasData = computed(() => Boolean(healthStore.data));
  const initialLoading = computed(() => healthStore.loading && !hasData.value);
  const showLoginGate = computed(
    () => !initialLoading.value && !idToken.value && (healthStore.source !== "live" || !hasData.value),
  );

  /**
   * Read id token from local storage.
   */
  const readSavedToken = () => {
    idToken.value = localStorage.getItem(ID_TOKEN_STORAGE_KEY) || "";
  };

  /**
   * Clear health state before refetch.
   */
  const clearHealthState = () => {
    healthStore.data = null;
    healthStore.error = "";
    healthStore.source = "";
  };

  /**
   * Log out and refresh data without token.
   */
  const logout = () => {
    localStorage.removeItem(ID_TOKEN_STORAGE_KEY);
    idToken.value = "";
    clearHealthState();
    healthStore.fetchHealth();
  };

  /**
   * Save Google credential and fetch live data.
   */
  const handleGoogleCredential = (response) => {
    const credential = response?.credential;
    if (!credential) return;
    idToken.value = credential;
    localStorage.setItem(ID_TOKEN_STORAGE_KEY, credential);
    healthStore.fetchHealth(credential);
  };

  /**
   * Render Google sign-in button.
   */
  const renderGoogleButton = () => {
    if (!googleReady.value || !googleButtonRoot.value) return;
    if (!googleClientId || !window.google?.accounts?.id) return;

    googleButtonRoot.value.innerHTML = "";
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleButtonRoot.value, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
    });
  };

  /**
   * Load Google login script once.
   */
  const loadGoogleScript = () => {
    if (window.google?.accounts?.id) {
      googleReady.value = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleReady.value = true;
    };
    script.onerror = () => {
      googleScriptError.value = true;
    };
    document.head.appendChild(script);
  };

  onMounted(() => {
    readSavedToken();
    loadGoogleScript();
  });

  watch(
    () => healthStore.error,
    (newError) => {
      if (newError.startsWith("AUTH ") && idToken.value) {
        logout();
      }
    },
  );

  watch(
    () => [googleReady.value, showLoginGate.value],
    async () => {
      await nextTick();
      if (showLoginGate.value) renderGoogleButton();
    },
    { immediate: true },
  );

  return {
    healthStore,
    hasGoogleClientId,
    authError,
    initialLoading,
    showLoginGate,
    googleScriptError,
    googleButtonRoot,
    idToken,
    logout,
  };
}
