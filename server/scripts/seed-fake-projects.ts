#!/usr/bin/env tsx

/**
 * Seed fake projects for testing the projects section.
 * Usage: tsx server/scripts/seed-fake-projects.ts <memberId> [count]
 *   memberId  the member who will own the seeded projects
 *   count     optional, defaults to 4
 *
 * Seeded titles are all prefixed "[seed] " so they can be grepped/deleted later:
 *   DELETE FROM projects WHERE title LIKE '[seed] %';
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';
import { PROJECT_STATES } from '@shared/constants';

const SAMPLES: Array<{
  title: string;
  description: string;
  state: (typeof PROJECT_STATES)[number];
  liveUrl?: string;
  repoUrl?: string;
  techStack?: string[];
}> = [
  {
    title: 'Tropical Tides',
    description: 'A collaborative playlist app for beach communities — surf-rock by day, bossa nova by night.',
    state: 'idea',
    techStack: ['React', 'Spotify API'],
  },
  {
    title: 'Canopy Census',
    description: 'Crowdsourced tree-mapping for urban forests. Snap a photo, log a species, watch the city grow greener.',
    state: 'mockup',
    techStack: ['React Native', 'PostGIS'],
  },
  {
    title: 'Mercado Mesh',
    description: 'Peer-to-peer barter board for neighborhood markets, built on local-first principles and end-to-end encryption.',
    state: 'working_prototype',
    repoUrl: 'https://github.com/example/mercado-mesh',
    techStack: ['TypeScript', 'libp2p', 'IndexedDB'],
  },
  {
    title: 'Pulso Civic',
    description: 'Open-source dashboard that turns city council minutes into searchable, shareable summaries.',
    state: 'beta',
    liveUrl: 'https://pulso.example.org',
    repoUrl: 'https://github.com/example/pulso-civic',
    techStack: ['Next.js', 'Postgres', 'OpenAI'],
  },
  {
    title: 'Capybara Calendar',
    description: 'A wholesome event scheduler designed around community pace, not productivity hustle.',
    state: 'idea',
    techStack: ['Svelte', 'iCal'],
  },
  {
    title: 'Río Relay',
    description: 'Distributed river-quality monitoring with low-cost sensors and a map of real-time readings.',
    state: 'working_prototype',
    repoUrl: 'https://github.com/example/rio-relay',
    techStack: ['ESP32', 'MQTT', 'Grafana'],
  },
];

async function main() {
  const memberIdArg = process.argv[2];
  const countArg = process.argv[3];

  if (!memberIdArg) {
    console.error('Usage: tsx server/scripts/seed-fake-projects.ts <memberId> [count]');
    process.exit(1);
  }

  const memberId = Number.parseInt(memberIdArg, 10);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    console.error(`Invalid memberId: ${memberIdArg}`);
    process.exit(1);
  }

  const count = countArg ? Number.parseInt(countArg, 10) : 4;
  if (!Number.isFinite(count) || count <= 0 || count > SAMPLES.length) {
    console.error(`Count must be between 1 and ${SAMPLES.length}`);
    process.exit(1);
  }

  await initializeKeyManager();
  await initializeDatabase();

  const member = await storage.getMember(memberId);
  if (!member) {
    console.error(`Member ${memberId} not found`);
    process.exit(1);
  }

  console.log(`Seeding ${count} project(s) for member ${memberId} (${member.displayName ?? member.email ?? 'unknown'})`);

  for (let i = 0; i < count; i++) {
    const sample = SAMPLES[i];
    const created = await storage.createProject(
      {
        title: `[seed] ${sample.title}`,
        description: sample.description,
        state: sample.state,
        liveUrl: sample.liveUrl,
        repoUrl: sample.repoUrl,
        techStack: sample.techStack,
        createdBy: memberId,
      } as Parameters<typeof storage.createProject>[0],
      [memberId],
    );
    console.log(`  ✓ #${created.id}  ${created.title}  [${created.state}]`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
