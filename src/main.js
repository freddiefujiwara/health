import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";

// Views are loaded lazily per route so the initial bundle stays small;
// chart-heavy views (with d3) only download when visited.
const Overview = () => import("./views/Overview.vue");
const BodyComposition = () => import("./views/BodyComposition.vue");
const Nutrition = () => import("./views/Nutrition.vue");
const Steps = () => import("./views/Steps.vue");
const Labs = () => import("./views/Labs.vue");
const Activity = () => import("./views/Activity.vue");
import "./style.css";
import { isStagingBuild, showStagingBanner } from "./staging-banner.js";

if (isStagingBuild(import.meta.env)) {
  showStagingBanner(document);
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: Overview },
    { path: "/overview", redirect: "/" },
    { path: "/body", component: BodyComposition },
    { path: "/nutrition", component: Nutrition },
    { path: "/steps", component: Steps },
    { path: "/labs", component: Labs },
    { path: "/activity", component: Activity },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
