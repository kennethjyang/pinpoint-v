/**
 * @file Helper script to check that all source files use file documentation.
 */

import fs from "fs";
import path from "path";

// Result flag.
let failed = false;

// All files in src.
const files = fs.readdirSync("./src", { recursive: true });

for (const file of files) {
  // Reconstruct path for tests.
  const fullPath = path.join("./src", file);

  // Skip directories.
  if (fs.statSync(fullPath).isDirectory()) continue;

  // Filter for TypeScript and Vue files.
  if (file.endsWith(".ts") || file.endsWith(".vue")) {
    // Extract contents.
    const content = fs.readFileSync(fullPath, "utf8");

    // Look for @file in a comment.
    if (!content.includes("* @file")) {
      console.error(`Missing @file comment in: ${fullPath}`);

      // Flag failed.
      failed = true;
    }
  }
}

// Exit with failure if needed.
if (failed) {
  process.exit(1);
} else {
  console.log("All TypeScript and Vue files are documented!");
}
