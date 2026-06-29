import { mount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import "./app.css";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("mount target #app not found");

const app = mount(App, { target });

// Offline shell: register the service worker and let autoUpdate swap in a new
// day's bundle on the next visit. No prompt - once a puzzle is loaded it plays
// offline. See docs/architecture/runtime/stack-and-bundle.md.
registerSW({ immediate: true });

export default app;
