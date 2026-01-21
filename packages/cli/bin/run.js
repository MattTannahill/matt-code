#!/usr/bin/env node

import {execute} from '@oclif/core'

// Avoid top-level await which can trigger warnings in some environments
const args = process.argv.slice(2).length === 0 ? ['ui'] : process.argv.slice(2);
try {
  await execute({args, dir: import.meta.url});
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
