import { mount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/jost";
import "@fontsource-variable/inter";
import "./app.css";
import App from "./App.svelte";
import { bootTheme } from "./lib/theme";
import { loadSave } from "./state/save.svelte";

// Stamp the saved theme/palette synchronously before mount so the colour scheme is
// right on the first paint; lib/theme.applyTheme later writes the exact tokens from
// config/palettes.json. See docs/concepts/ui-shell.md.
const booted = loadSave().settings;
bootTheme(booted.theme, booted.palette);

const target = document.getElementById("app");
if (!target) throw new Error("mount target #app not found");

const app = mount(App, { target });

// Offline shell: register the service worker and let autoUpdate swap in a new
// day's bundle on the next visit. No prompt - once a puzzle is loaded it plays
// offline. See docs/architecture/runtime/stack-and-bundle.md.
registerSW({ immediate: true });

export default app;
