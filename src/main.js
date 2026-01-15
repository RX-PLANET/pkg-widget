import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App);

import { i18n } from "./locale";
app.use(i18n);

import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
app.use(ElementPlus);

import * as ElementPlusIconsVue from "@element-plus/icons-vue";
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}

app.mount('#app')
