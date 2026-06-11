#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { optimizeRoute, buildNavigation, geocode, haversineKm, type Stop } from './engine.js';

const OSRM_URL = process.env.OSRM_URL; // optional, e.g. https://router.project-osrm.org
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

const server = new McpServer({
  name: 'fleetops-routing',
  version: '1.0.0',
});

const stopSchema = z.object({
  id: z.string().describe('Stable identifier for this stop (e.g. task id)'),
  label: z.string().optional().describe('Human-readable name'),
  lat: z.number().describe('Latitude'),
  lng: z.number().describe('Longitude'),
  serviceTimeMin: z.number().optional().describe('Minutes spent on site'),
});

// ─────────────────────────────────────────────
// optimize_route — the core deterministic solver.
// ─────────────────────────────────────────────
server.tool(
  'optimize_route',
  'Compute the optimal visiting order for a set of stops (multi-stop TSP). ' +
    'Uses the OSRM road-network engine when configured, otherwise a ' +
    'nearest-neighbor heuristic over great-circle distance. Distances are ' +
    'computed deterministically — do not estimate them yourself; call this tool.',
  {
    stops: z.array(stopSchema).min(1).describe('Stops to visit'),
    roundtrip: z.boolean().optional().describe('Return to the first stop (default false)'),
    fixedStart: z.boolean().optional().describe('Keep the first stop as the origin (default true)'),
    avgSpeedKmh: z.number().optional().describe('Average speed for duration estimate when OSRM is unavailable (default 30)'),
  },
  async ({ stops, roundtrip, fixedStart, avgSpeedKmh }) => {
    const result = await optimizeRoute(stops as Stop[], {
      osrmUrl: OSRM_URL,
      roundtrip,
      fixedStart,
      avgSpeedKmh,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ─────────────────────────────────────────────
// build_navigation — Waze / Google Maps deep-links.
// ─────────────────────────────────────────────
server.tool(
  'build_navigation',
  'Build free turn-by-turn navigation deep-links (Waze + Google Maps, ' +
    'including a single multi-stop Google Maps link) for an ordered list of stops.',
  {
    orderedStops: z.array(stopSchema).min(1).describe('Stops already in visiting order'),
  },
  async ({ orderedStops }) => {
    const nav = buildNavigation(orderedStops as Stop[]);
    return { content: [{ type: 'text', text: JSON.stringify(nav, null, 2) }] };
  }
);

// ─────────────────────────────────────────────
// geocode_address — free OSM geocoding (Nominatim).
// ─────────────────────────────────────────────
server.tool(
  'geocode_address',
  'Resolve a free-text address to coordinates using OpenStreetMap Nominatim. ' +
    'Use this before optimize_route when a stop only has an address.',
  {
    query: z.string().describe('Address or place name to geocode'),
  },
  async ({ query }) => {
    const r = await geocode(query, NOMINATIM_URL);
    if (!r) {
      return { content: [{ type: 'text', text: JSON.stringify({ found: false, query }) }], isError: false };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ found: true, ...r }) }] };
  }
);

// ─────────────────────────────────────────────
// distance_matrix — pairwise distances (helper for reasoning).
// ─────────────────────────────────────────────
server.tool(
  'distance_matrix',
  'Compute a pairwise great-circle distance matrix (km) between stops. ' +
    'Useful for explaining grouping decisions; not a substitute for optimize_route.',
  {
    stops: z.array(stopSchema).min(2).describe('Stops to compare'),
  },
  async ({ stops }) => {
    const s = stops as Stop[];
    const matrix = s.map((a) => s.map((b) => Math.round(haversineKm(a, b) * 10) / 10));
    return {
      content: [{ type: 'text', text: JSON.stringify({ ids: s.map((x) => x.id), matrix }, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logs; stdout is reserved for the MCP protocol.
  console.error('fleetops-routing MCP server running (OSRM:', OSRM_URL ? 'on' : 'off', ')');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
