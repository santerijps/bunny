import type { AppConfig, Page, ResolvedPageMeta } from "../types";
import { resolve_page_meta } from "../util";

// TODO: Figure out how to include a meta section
export async function convert_page(text: string, page: Page, config: AppConfig): Promise<[string, ResolvedPageMeta]> {
  const meta = await resolve_page_meta({}, page, config);
  return [text, meta];
}
