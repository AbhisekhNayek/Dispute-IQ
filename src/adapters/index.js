/**
 * DisputeIQ — Adapter factory
 *
 * Returns the correct adapter based on the VITE_MODE environment variable.
 *
 *   VITE_MODE        Adapter
 *   ─────────        ───────
 *   (default)        Simulator  — demo data, no network calls
 *   'simulator'      Simulator
 *   'airwallex'      Airwallex  — calls local proxy → real Airwallex API
 *   'sandbox'        Airwallex  — same proxy, sandbox credentials in .env
 *
 * Usage:
 *   import { getAdapter } from './adapters';
 *   const api = getAdapter();
 *   const disputes = await api.listDisputes();
 *
 * @module adapters/index
 */

import * as simulatorAdapter from './simulatorAdapter.js';
import * as airwallexAdapter from './airwallexAdapter.js';

/**
 * @typedef {Object} DisputeAdapter
 * @property {() => Promise<any[]>}                      listDisputes
 * @property {(id: string) => Promise<any>}              getDispute
 * @property {(id: string) => Promise<any>}              acceptDispute
 * @property {(id: string, evidence?: string[]) => Promise<any>} challengeDispute
 */

/**
 * Get the active dispute adapter.
 *
 * Reads `import.meta.env.VITE_MODE` at call time, so it can react to
 * hot-reload changes during development.
 *
 * @returns {DisputeAdapter}
 */
export function getAdapter() {
  const mode = (import.meta.env.VITE_MODE || 'simulator').toLowerCase();

  if (mode === 'airwallex' || mode === 'sandbox') {
    return airwallexAdapter;
  }

  // Default: simulator
  return simulatorAdapter;
}

/**
 * Convenience: current mode label for UI display.
 * @returns {'simulator'|'airwallex'|'sandbox'}
 */
export function getModeName() {
  const mode = (import.meta.env.VITE_MODE || 'simulator').toLowerCase();
  if (mode === 'airwallex' || mode === 'sandbox') return mode;
  return 'simulator';
}
