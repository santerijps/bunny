import type { AppConfig, Page, ResolvedPageMeta } from "../types";
import { resolve_page_meta } from "../util";
import { render } from "pug";


// TODO: Figure out how to include a meta section
export async function convert_page(text: string, page: Page, config: AppConfig): Promise<[string, ResolvedPageMeta]> {
  const html = render(text);
  const meta = await resolve_page_meta({}, page, config);
  return [html, meta];
}


export function convert_text(text: string) {
  return render(text);
}
