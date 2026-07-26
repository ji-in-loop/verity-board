#!/usr/bin/env node
import { parseReviewArgs, CliArgumentError } from './args.js';
import { runReviewCommand, ReviewCommandError } from './review-command.js';

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command !== 'review') {
    console.error(
      `Unknown command "${command ?? ''}". Usage: verity-board review --committee <id> --case <path>`,
    );
    process.exitCode = 1;
    return;
  }

  const args = parseReviewArgs(rest);
  const { markdown, outDir } = await runReviewCommand(args);

  console.log(markdown);
  console.log(`\n(Reports written to ${outDir})`);
}

main().catch((error) => {
  if (error instanceof CliArgumentError || error instanceof ReviewCommandError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
