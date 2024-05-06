import type { AppConfig, Page } from "../types";
import { BunnyError, read_file_text } from "../util";

import * as md from "./md";
import * as html from "./html";
import * as pug from "./pug";


export async function convert_page(page: Page, config: AppConfig) {
  const text = await read_file_text(page.src);
  switch (page.ext) {
  case ".md":
    return await md.convert_page(text, page, config);
  case ".htm":
  case ".html":
    return await html.convert_page(text, page, config);
  case ".pug":
    return await pug.convert_page(text, page, config);
  default:
    throw new BunnyError(`[convert_page] Unsupported page type: ${page.ext}`);
  }
}


export async function convert_text(text: string, ext: string) {
  switch (ext) {
  case ".md":
    return md.convert_text(text);
  case ".htm":
  case ".html":
    return text;
  case ".pug":
    return pug.convert_text(text);
  default:
    throw new BunnyError(`[convert_text] Unsupported file extension: ${ext}`);
  }
}
