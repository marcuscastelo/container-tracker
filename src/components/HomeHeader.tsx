import { A } from "@solidjs/router";

export default function HomeHeader() {
  return (
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold flex items-center gap-3">
        <span class="bg-blue-700 text-white px-3 py-1 rounded">TMS Caseiro</span>
      </h1>
      <nav class="flex items-center gap-4 text-sm text-gray-600">
        <A href="#" class="hover:underline">Dashboard</A>
        <A href="#" class="hover:underline">Embarques</A>
        <A href="#" class="hover:underline">Containers</A>
      </nav>
    </header>
  );
}
