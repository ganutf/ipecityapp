#!/usr/bin/env tsx

/**
 * Populate Pulse Types Script
 * 
 * This script populates the pulse_types table with initial data
 */

import { storage } from "../storage";

async function populatePulseTypes() {
  console.log("🚀 Populating pulse types...");

  try {
    // Define initial pulse types
    const initialPulseTypes = [
      {
        name: "Farcaster Post Engagement",
        description: "Liking or sharing a post",
      },
      {
        name: "Community Discussion",
        description: "Participating in community discussions",
      },
      {
        name: "Content Creation",
        description: "Creating original content for the community",
      },
      {
        name: "Event Participation",
        description: "Participating in community events",
      },
      {
        name: "Weekly Challenge",
        description: "Completing weekly community challenges",
      }
    ];

    // Create pulse types
    for (const pulseTypeData of initialPulseTypes) {
      try {
        const pulseType = await storage.createPulseType(pulseTypeData);
        console.log(`✅ Created pulse type: ${pulseType.name} (ID: ${pulseType.id})`);
      } catch (error: any) {
        if (error.message.includes('unique constraint')) {
          console.log(`⚠️  Pulse type "${pulseTypeData.name}" already exists, skipping...`);
        } else {
          console.error(`❌ Failed to create pulse type "${pulseTypeData.name}":`, error);
        }
      }
    }

    console.log("✅ Pulse types population completed!");
    
  } catch (error) {
    console.error("❌ Failed to populate pulse types:", error);
    throw error;
  }
}

// Run the population
populatePulseTypes()
  .then(() => {
    console.log("🎉 Pulse types populated successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed to populate pulse types:", error);
    process.exit(1);
  });

export { populatePulseTypes };