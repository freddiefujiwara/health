import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  SESSION_TOKEN_STORAGE_KEY,
  useHealthStore,
} from "@/stores/health";

const LEGACY_ID_TOKEN_STORAGE_KEY = "health-google-id-token";

// Unified sign-in gate messages (same wording across all the apps).
// The raw API error is categorized here so internal "AUTH ..." strings
// never reach the screen.
const LOGIN_FAILED_MESSAGE = "ログインに失敗しました。もう一度お試しください。";
const ACCOUNT_NOT_ALLOWED_MESSAGE = "このアカウントでは利用できません。";
const SESSION_EXPIRED_MESSAGE = "ログインの有効期限が切れました。再度ログインしてください。";

// The API reports an expired owner session as "AUTH 401: session
// expired or invalid" (the share variant reads "share session expired
// or invalid" and lands on the share-expired screen instead).
const isSessionExpiredError = (error) => error.includes(": session expired or invalid");
// A Google account that is not the owner is rejected by the API as
// "AUTH 403: forbidden email".
const isAccountNotAllowedError = (error) => error.includes("forbidden");

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
  const sessionExpiredNotice = ref(false);

  const healthStore = useHealthStore();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const hasGoogleClientId = computed(() => Boolean(googleClientId));
  const authError = computed(() => healthStore.error.startsWith("AUTH "));
  /**
   * The single sign-in gate error line, mapped from the raw API error.
   * An expired saved session keeps its message even after the
   * automatic logout refetch replaces the store error with a generic
   * one.
   */
  const gateErrorMessage = computed(() => {
    if (sessionExpiredNotice.value) return SESSION_EXPIRED_MESSAGE;
    const error = healthStore.error;
    if (!error.startsWith("AUTH ")) return "";
    if (isSessionExpiredError(error)) return SESSION_EXPIRED_MESSAGE;
    if (isAccountNotAllowedError(error)) return ACCOUNT_NOT_ALLOWED_MESSAGE;
    return LOGIN_FAILED_MESSAGE;
  });
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
    sessionExpiredNotice.value = false;
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
        if (isSessionExpiredError(newError)) {
          sessionExpiredNotice.value = true;
        }
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
    gateErrorMessage,
    initialLoading,
    showLoginGate,
    showShareExpired,
    googleScriptError,
    googleButtonRoot,
    idToken,
    logout,
  };
}
