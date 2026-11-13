import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  SESSION_TOKEN_STORAGE_KEY,
  useHealthStore,
} from "@/stores/health";

const LEGACY_ID_TOKEN_STORAGE_KEY = "health-google-id-token";

/**
 * Manage the Google sign-in gate for the app shell (same scheme as asset).
 * The ref below holds the 30-day owner session token exchanged at
 * sign-in (not the 1-hour Google ID token, which is never stored).
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
    () => !initialLoading.value && !idToken.value && !healthStore.shareMode && (healthStore.source !== "live" || !hasData.value),
  );
  const showShareExpired = computed(
    () => healthStore.shareMode && !initialLoading.value && !hasData.value,
  );

  /**
   * Read the owner session token from local storage, dropping any
   * legacy stored Google ID token left by the old scheme.
   */
  const readSavedToken = () => {
    localStorage.removeItem(LEGACY_ID_TOKEN_STORAGE_KEY);
    idToken.value = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "";
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
   * Log out (revoking the owner session) and refresh data without it.
   */
  const logout = () => {
    healthStore.revokeSession();
    idToken.value = "";
    clearHealthState();
    healthStore.fetchHealth();
  };

  /**
   * Exchange the Google credential for a 30-day owner session, then
   * fetch live data with it.
   */
  const handleGoogleCredential = async (response) => {
    const credential = response?.credential;
    if (!credential) return;
    const sessionToken = await healthStore.exchangeSession(credential);
    if (!sessionToken) return;
    idToken.value = sessionToken;
    healthStore.fetchHealth();
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
    showShareExpired,
    googleScriptError,
    googleButtonRoot,
    idToken,
    logout,
  };
}
