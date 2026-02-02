// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
// No global diagnostics here; client mount below.

mount(() => <StartClient />, document.getElementById("app")!);
