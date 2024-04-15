import { type HTMLElement } from "node-html-parser";
import type { Page } from "./types";
import $path from "node:path";
import * as $util from "./util";

export function query_or_throw(selector: string, root: HTMLElement) {
  const element = root.querySelector(selector);
  if (element === null) {
    throw new $util.BunnyError(`[query_or_throw] Element not found with selector: ${selector}`);
  }
  return element;
}

export function has_title(document_head: HTMLElement) {
  const title = document_head.querySelector("title");
  return title ? title.innerText.length > 0 : false;
}

export function get_title(page: Page, title: string) {
  if (title.length > 0) {
    return title;
  } else {
    const regex = new RegExp(`\\.page${page.ext}$`);
    return $path.basename(page.src)
      .replace(regex, "")
      .replaceAll("_", " ")
      .replaceAll(/\b(?<!-)\w/g, (x) => x.toUpperCase());
  }
}

export function set_title(document_head: HTMLElement, title: string) {
  const title_element = document_head.querySelector("title");
  if (title_element === null) {
    document_head.innerHTML += `<title>${title}</title>\n`;
  } else {
    title_element.innerHTML = title;
  }
}

export function convert_local_links_to_html(document_body: HTMLElement) {
  for (const anchor of document_body.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (typeof href !== "undefined" && !$util.is_remote_url(href)) {
      anchor.setAttribute("href", href.replace(/\.page\.(?:html|md|pug)$/, ".html"));
    }
  }
}

export function remove_favicons(document_head: HTMLElement) {
  for (const link of document_head.querySelectorAll("link")) {
    const rel = link.getAttribute("rel");
    const href = link.getAttribute("href");
    if (typeof rel !== "undefined" && typeof href !== "undefined" && rel.includes("icon")) {
      link.remove();
    }
  }
}
