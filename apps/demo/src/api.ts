import { demoData } from "./demo-data";
import type { DashboardData } from "./types";

const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");

export async function loadDashboard(): Promise<{ data: DashboardData; source: "demo" | "api" }> {
  if (!apiBase) return { data: demoData, source: "demo" };
  try {
    const response = await fetch(`${apiBase}/dashboard?date=${demoData.businessDate}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
    return { data: await response.json() as DashboardData, source: "api" };
  } catch {
    return { data: demoData, source: "demo" };
  }
}
