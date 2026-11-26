/**
 * Migration script: Convert parent_child relationships to father/mother
 * based on the parent person's gender.
 *
 * Run with: node scripts/migrate-relationships.mjs
 *
 * What it does:
 * 1. Finds all relationships with type 'parent_child'
 * 2. Looks up the fromPerson (parent) to check their gender
 * 3. Sets type to 'father' if male, 'mother' if female
 * 4. If gender is unknown, defaults to 'father' (you can fix manually)
 * 5. Adds spouseStatus: 'active' to all spouse relationships
 * 6. Removes the old 'direction' and 'label' fields
 * 7. Removes any 'sibling' type relationships (no longer supported)
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read .env manually
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
}

const MONGODB_URI = envVars.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  const db = client.db(); // uses the default DB from the URI
  const relationships = db.collection('relationships');
  const persons = db.collection('people'); // Mongoose pluralizes 'Person' to 'people'

  // Step 1: Convert parent_child → father/mother
  const parentChildRels = await relationships.find({ type: 'parent_child' }).toArray();
  console.log(`Found ${parentChildRels.length} parent_child relationships to migrate.`);

  let fatherCount = 0;
  let motherCount = 0;
  let unknownCount = 0;

  for (const rel of parentChildRels) {
    // Look up the parent person's gender
    const parentPerson = await persons.findOne({ _id: rel.fromPersonId });
    
    let newType;
    if (parentPerson?.gender === 'female') {
      newType = 'mother';
      motherCount++;
    } else if (parentPerson?.gender === 'male') {
      newType = 'father';
      fatherCount++;
    } else {
      // Unknown gender — default to father, user can fix manually
      newType = 'father';
      unknownCount++;
      console.warn(`  ⚠ Relationship ${rel._id}: parent ${rel.fromPersonId} has no/unknown gender, defaulting to 'father'`);
    }

    await relationships.updateOne(
      { _id: rel._id },
      {
        $set: { type: newType },
        $unset: { direction: '', label: '' },
      }
    );
  }

  console.log(`  ✓ Converted: ${fatherCount} father, ${motherCount} mother, ${unknownCount} unknown (defaulted to father)`);

  // Step 2: Add spouseStatus to spouse relationships and remove old fields
  const spouseResult = await relationships.updateMany(
    { type: 'spouse' },
    {
      $set: { spouseStatus: 'active' },
      $unset: { direction: '', label: '' },
    }
  );
  console.log(`  ✓ Updated ${spouseResult.modifiedCount} spouse relationships (added spouseStatus: 'active')`);

  // Step 3: Remove sibling relationships (no longer supported)
  const siblingResult = await relationships.deleteMany({ type: 'sibling' });
  if (siblingResult.deletedCount > 0) {
    console.log(`  ✓ Removed ${siblingResult.deletedCount} sibling relationships (no longer supported)`);
  }

  console.log('\n✅ Migration complete!');
  await client.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
