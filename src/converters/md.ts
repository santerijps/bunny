import { SHOWDOWN_OPTIONS } from "../constants";
import type { AppConfig, Page, ResolvedPageMeta } from "../types";
import { resolve_page_meta } from "../util";
import { Converter } from "showdown";
import { parse } from "yaml";


export async function convert_page(text: string, page: Page, config: AppConfig): Promise<[string, ResolvedPageMeta]> {
  const converter = new Converter(SHOWDOWN_OPTIONS);
  const html = converter.makeHtml(text);
  const yaml = parse(converter.getMetadata(true) as string) ?? {};
  const meta = await resolve_page_meta(yaml, page, config);
  return [html, meta];
}


export function convert_text(text: string) {
  const converter = new Converter(SHOWDOWN_OPTIONS);
  return converter.makeHtml(text);
}
