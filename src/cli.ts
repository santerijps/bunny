import * as $rimraf from "rimraf";
import { process_directory } from ".";
import * as $constants from "./constants";
import start_dev_server from "./dev_server";
import type { AppConfig } from "./types";
import * as $util from "./util";
import $arg from "arg"
import $process from "node:process";

async function main() {
  const config = parse_args();
  $rimraf.rimrafSync(config.dst_dir_path, {preserveRoot: false});
  if (config.watch) {
    return start_dev_server(config);
  } else {
    await process_directory(config);
  }
}

function print_app_usage() {
  const message = [
    "",
    `Usage: bunny [project-directory] [options...]`,
    "",
    "bunny: A static site generator for truly portable sites.",
    "All sites work as is online and offline, making them portable by default.",
    "",
    "Options:",
    "  --out, -o [directory-path]       The directory to which the converted files should be placed.",
    "  --minify, -m                     Minify the generated HTML documents.",
    "  --watch, -w                      Watch for file changes and refresh the browser page on changes.",
    "",
  ].join("\n");
  console.warn(message);
}

function parse_args(): AppConfig {
  const args = $arg({
    "--minify": Boolean,
    "-m": Boolean,
    "--watch": Boolean,
    "-w": Boolean,
    "--port": Number,
    "-p": Number,
    "--out": String,
    "-o": String,
  }, {
    argv: process.argv.slice(2),
    permissive: true,
  });

  if (args._.length === 0) {
    print_app_usage();
    $process.exit(1);
  }

  let port = $util.get_or_default(args, ["--port", "-p"], 8080);
  if (!Number.isInteger(port)) {
    throw new $util.BunnyError(`[parse_args] Invalid port: ${port}`)
  }

  return {
    src_dir_path: $util.relative_path_to_absolute(args._[0], $constants.WORKING_DIRECTORY),
    dst_dir_path: $util.relative_path_to_absolute(
      $util.get_or_default(args, ["--out", "-o"], "out"),
      $constants.WORKING_DIRECTORY,
    ),
    minify: $util.get_or_default(args, ["--minify", "-m"], false),
    watch: $util.get_or_default(args, ["--watch", "-w"], false),
    port: port,
  };
}

await main();
