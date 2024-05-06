import type { AppConfig, Page } from "../types";
import { BunnyError, read_file_text } from "../util";

import * as md from "./md";
import * as html from "./html";
import * as pug from "./pug";
import * as ejs from "./ejs";
import * as mustache from "./mustache";
import * as handlebars from "./handlebars";


export async function convert_page(data: any, page: Page, config: AppConfig) {
  const text = await read_file_text(page.src);
  switch (page.ext) {
  case ".md":
    return await md.convert_page(text, page, config);
  case ".htm":
  case ".html":
    return await html.convert_page(text, page, config);
  case ".pug":
    return await pug.convert_page(text, data, page, config);
  case ".ejs":
    return await ejs.convert_page(text, data, page, config);
  case ".mustache":
    return await mustache.convert_page(text, data, page, config);
  case ".hbs":
    return await handlebars.convert_page(text, data, page, config);
  default:
    throw new BunnyError(`[convert_page] Unsupported page type: ${page.ext}`);
  }
}


export async function convert_text(text: string, data: any, ext: string) {
  switch (ext) {
  case ".md":
    return md.convert_text(text);
  case ".htm":
  case ".html":
    return text;
  case ".pug":
    return pug.convert_text(text, data);
  case ".ejs":
    return ejs.convert_text(text, data);
  case ".mustache":
    return mustache.convert_text(text, data);
  case ".hbs":
    return handlebars.convert_text(text, data);
  default:
    throw new BunnyError(`[convert_text] Unsupported file extension: ${ext}`);
  }
}
