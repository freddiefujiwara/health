import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Overview from "./views/Overview.vue";
import BodyComposition from "./views/BodyComposition.vue";
import Nutrition from "./views/Nutrition.vue";
import Steps from "./views/Steps.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/overview" },
    { path: "/overview", component: Overview },
    { path: "/body", component: BodyComposition },
    { path: "/nutrition", component: Nutrition },
    { path: "/steps", component: Steps },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
