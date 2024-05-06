import type { AppConfig, Page, ResolvedPageMeta } from "../types";
import { resolve_page_meta } from "../util";
import Handlebars from "handlebars";


// TODO: Figure out how to include a meta section
export async function convert_page(text: string, data: any, page: Page, config: AppConfig): Promise<[string, ResolvedPageMeta]> {
  const html = convert_text(text, data);
  const meta = await resolve_page_meta({}, page, config);
  return [html, meta];
}


export function convert_text(text: string, data: any) {
  const render = Handlebars.compile(text, {});
  return render(data, {});
}
