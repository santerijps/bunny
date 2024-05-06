import type { AppConfig, Page, ResolvedPageMeta } from "./types";
import $path from "node:path";
import * as $util from "./util";
import * as $constants from "./constants";
import $html_parser, {type HTMLElement} from "node-html-parser";
import * as $document from "./util/document";
import * as $minify from "minify";
import $hljs from "highlight.js";
import $he from "he";
import * as $sass from "sass";
import $less from "less";
import $typescript from "typescript";
import Logger from "./util/logger";
import * as $converters from "./converters";

// TODO:  Build a showdown.js extension that checks whether ![]() shold be embedded or not.
//        For example, the pattern `@![]()` could produce an embedded resource
//        https://github.com/showdownjs/showdown/wiki/extensions

// TODO:  Implement page dependency mapping.
//        Page        => List of dependencies
//        Dependency  => List of pages that depend on it


export async function process_directory(config: AppConfig) {
  const glob = new Bun.Glob("**/*");
  for await (const relative_file_path of glob.scan(config.src_dir_path)) {
    const absolute_file_path = $path.join(config.src_dir_path, relative_file_path);
    if ($util.is_page_file(relative_file_path)) {
      const page = $util.resolve_page(absolute_file_path, config);
      await try_process_page(page, config);
    }
  }
}


export async function try_process_page(page: Page, config: AppConfig) {
  try {
    await process_page(page, config)
  } catch (error: any) {
    const relative_path = page.src.replace(config.src_dir_path, "").replace(/^\\/, "");
    Logger.error(relative_path, error.toString());
  }
}


export async function process_page(page: Page, config: AppConfig) {
  let [html, meta] = await $converters.convert_page({}, page, config);

  if (meta.layout) {
    if ($util.is_full_html_document(html)) {
      throw new $util.BunnyError(`[process_page] Cannot add layout, the page is a full HTML document already: ${page.src}`);
    }
    let layout = await meta.layout.file.read_text();
    layout = await $converters.convert_text(layout, {}, $path.extname(meta.layout.file.url));
    layout = prefix_relative_urls(layout, $path.dirname(meta.layout.file.url));
    html = layout.replaceAll("$slot", html);
  } else if (!$util.is_full_html_document(html)) {
    html = $constants.DEFAULT_HTML_LAYOYUT.replaceAll("$slot", html);
  }

  html = await process_page_functions(html, page.src_dir);
  html = process_page_variables(html, page, meta);

  const document = $html_parser.parse(html);
  const document_head = $document.query_or_throw("head", document);
  const document_body = $document.query_or_throw("body", document);

  if (!$document.has_title(document_head)) {
    const document_title = $document.get_title(page, meta.title);
    $document.set_title(document, document_title);
  }

  await process_hard_coded_resources(document, page, config);

  if (meta.favicon) {
    $document.remove_favicons(document_head);
    if (meta.favicon.embed) {
      const data_url = await meta.favicon.file.data_url();
      document_head.innerHTML += `<link rel="icon" href="${data_url}">\n`;
    } else {
      document_head.innerHTML += `<link rel="icon" href="${meta.favicon.web_friendly_dst}">\n`;
      if (!$util.local_file_exists(meta.favicon.dst)) {
        await meta.favicon.file.copy(meta.favicon.dst);
        Logger.copy(meta.favicon.dst);
      }
    }
  }

  if (meta.hljs) {
    const theme = typeof meta.hljs === "string" ? meta.hljs : "default";
    const theme_file_path = $path.join($constants.HLJS_STYLES_DIR, `${theme}.min.css`);
    const theme_file_content = await $util.read_file_text(theme_file_path);
    document_head.innerHTML += `<style>${theme_file_content}</style>\n`;

    document_body.querySelectorAll("pre").forEach((pre) => {
      // TODO: html-parser-node cannot find code -tags for some reason, this solution is a hack
      const regex = /<code class="(.+?) language-.+?">(.*?)<\/code>/s;
      const match = pre.innerHTML.match(regex);
      if (match === null) {
        return;
      }
      const language = match[1], source_code = match[2];
      const highlighted_code = $hljs.highlight(source_code, {language}).value;
      const decoded_code = $he.decode(highlighted_code);
      pre.innerHTML = `<code class="hljs">${decoded_code}</code>`;
    });
  }

  for (const resource of meta.resources) {
    await process_resource(resource, document, config);
  }

  $document.convert_local_links_to_html(document_body);
  html = document.toString();

  await $util.write_file(page.dst, html);
  Logger.write(page.dst);

  if (config.minify) {
    html = await $minify.minify(page.dst, $constants.MINIFY_OPTIONS);
    await $util.write_file(page.dst, html);
    Logger.minify(page.dst);
  }
}


export async function process_page_functions(html: string, working_directory: string) {
  const regex = /\{\{\s*([\w]+)\s+(.*?)\s*\}\}/;
  while (true) {
    const match = html.match(regex);
    if (match === null) {
      break;
    }
    const [full_match, function_name, unresolved_src] = match;
    const src = $util.resolve_src_location(unresolved_src, working_directory);
    switch (function_name) {
      case "embed": {
        const file_content = await $util.read_file_text(src);
        html = html.replace(regex, file_content);
        break;
      }
      case "render": {
        const file_content = await $util.read_file_text(src);
        const ext = $path.extname(src);
        const text = await $converters.convert_text(file_content, {}, ext);
        html = html.replace(regex, text);
        break;
      }
      case "data_url": {
        const data_url = await $util.url_to_base64_data_url(src);
        html = html.replace(regex, data_url);
        break;
      }
      default:
        throw new $util.BunnyError(`Unknown template function: ${full_match}`);
    }
  }
  return html;
}


export function process_page_variables(html: string, page: Page, meta: ResolvedPageMeta) {
  return html.replaceAll("$title", $document.get_title(page, meta.title));
}


export async function process_resource(resource: $util.LazyResource, document: HTMLElement, config: AppConfig) {
  const mime_type = $util.parse_file_mime_type(resource.src).unwrap();
  const dst_element = $document.query_or_throw(resource.target, document);

  if (!resource.embed && resource.is_remote) {
    throw new $util.BunnyError(`[process_resource] Cannot add remote resource without embedding it: ${resource.src}`);
  }

  switch (mime_type.type) {
    case "text": {
      switch (resource.file.extension) {
        case ".htm":
        case ".html": {
          const src = resource.embed ? await resource.file.data_url() : resource.web_friendly_dst;
          if (dst_element.tagName === "EMBED") {
            dst_element.setAttribute("type", "text/html");
            dst_element.setAttribute("src", src);
          } else {
            dst_element.innerHTML += `<embed type="text/html" src="${src}" />\n`;
          }
          if (!resource.embed && !$util.local_file_exists(resource.dst)) {
            await resource.copy(resource.dst);
            Logger.copy(resource.dst);
          }
        } break;
        case ".css": {
          if (resource.embed) {
            const content = await resource.read_text();
            if (dst_element.tagName === "STYLE") {
              dst_element.innerHTML += content;
            } else {
              dst_element.innerHTML += `<style>${content}</style>\n`;
            }
          } else {
            if (!$util.local_file_exists(resource.dst)) {
              await resource.copy(resource.dst);
              Logger.copy(resource.dst);
            }
            if (dst_element.tagName === "LINK") {
              dst_element.setAttribute("href", resource.web_friendly_dst);
            } else {
              dst_element.innerHTML += `<link rel="stylesheet" href="${resource.web_friendly_dst}">\n`;
            }
          }
        } break;
        case ".scss": {
          if (resource.embed) {
            const compile_result = await $sass.compileAsync(resource.src);
            if (dst_element.tagName === "STYLE") {
              dst_element.innerHTML += compile_result.css;
            } else {
              dst_element.innerHTML += `<style>${compile_result.css}</style>\n`;
            }
          } else {
            const dst_file_path = $util.replace_extension(resource.dst, ".css");
            const web_friendly_dst = $util.to_web_friendly_url(dst_file_path, config);
            await resource.file.process_text_and_copy(dst_file_path, async (text) => {
              const result = await $sass.compileStringAsync(text);
              return result.css;
            });
            Logger.write(resource.dst);
            if (dst_element.tagName === "LINK") {
              dst_element.setAttribute("href", web_friendly_dst);
            } else {
              dst_element.innerHTML += `<link rel="stylesheet" href="${web_friendly_dst}">\n`;
            }
          }
        } break;
        case ".less": {
          if (resource.embed) {
            const content = await resource.read_text();
            const render_output = await $less.render(content, {});
            if (dst_element.tagName === "STYLE") {
              dst_element.innerHTML += render_output.css;
            } else {
              dst_element.innerHTML += `<style>${render_output.css}</style>\n`;
            }
          } else {
            const dst_file_path = $util.replace_extension(resource.dst, ".css");
            const web_friendly_dst = $util.to_web_friendly_url(dst_file_path, config);
            await resource.file.process_text_and_copy(dst_file_path, async (text) => {
              const render_output = await $less.render(text, {});
              return render_output.css;
            });
            Logger.write(resource.dst);
            if (dst_element.tagName === "LINK") {
              dst_element.setAttribute("href", web_friendly_dst);
            } else {
              dst_element.innerHTML += `<link rel="stylesheet" href="${web_friendly_dst}">\n`;
            }
          }
        } break;
        case ".js": {
          if (resource.embed) {
            const content = await resource.read_text();
            if (dst_element.tagName === "SCRIPT") {
              dst_element.innerHTML += content;
            } else {
              dst_element.innerHTML += `<script>${content}</script>\n`;
            }
          } else {
            if (!$util.local_file_exists(resource.dst)) {
              await resource.copy(resource.dst);
              Logger.copy(resource.dst);
            }
            if (dst_element.tagName === "SCRIPT") {
              dst_element.setAttribute("src", resource.web_friendly_dst);
            } else {
              dst_element.innerHTML += `<script src="${resource.web_friendly_dst}"></script>\n`;
            }
          }
        } break;
        case ".ts": {
          if (resource.embed) {
            const content = await resource.read_text();
            const js = $typescript.transpile(content, $constants.TYPESCRIPT_OPTIONS);
            if (dst_element.tagName === "SCRIPT") {
              dst_element.innerHTML += js;
            } else {
              dst_element.innerHTML += `<script>${js}</script>\n`;
            }
          } else {
            const dst_file_path = $util.replace_extension(resource.dst, ".js");
            const web_friendly_dst = $util.to_web_friendly_url(dst_file_path, config);
            await resource.file.process_text_and_copy(dst_file_path, (text) => {
              return $typescript.transpile(text, $constants.TYPESCRIPT_OPTIONS);
            });
            Logger.write(resource.dst);
            if (dst_element.tagName === "SCRIPT") {
              dst_element.setAttribute("src", web_friendly_dst);
            } else {
              dst_element.innerHTML += `<script src="${web_friendly_dst}"></script>\n`;
            }
          }
        } break;
        default:
          throw new $util.BunnyError(`[process_resource] Unsupported resource text type: ${resource.src}`);
      }
    } break;
    case "image": {
      const type = `${mime_type.type}/${mime_type.subtype}`;
      const src = resource.embed ? await resource.file.data_url() : resource.web_friendly_dst;
      if (dst_element.tagName === "IMG") {
        dst_element.setAttribute("type", type);
        dst_element.setAttribute("src", src);
      } else {
        dst_element.innerHTML += `<img type="${type}" src="${src}" />\n`;
      }
      if (!resource.embed && !$util.local_file_exists(resource.dst)) {
        await resource.copy(resource.dst);
        Logger.copy(resource.dst);
      }
    } break;
    case "audio":
    case "video": {
      const type = `${mime_type.type}/${mime_type.subtype}`;
      const src = resource.embed ? await resource.file.data_url() : resource.web_friendly_dst;
      if (dst_element.tagName === mime_type.type.toUpperCase()) {
        dst_element.setAttribute("type", type);
        dst_element.setAttribute("src", src);
      } else {
        dst_element.innerHTML += `<${mime_type.type} type="${type}" src="${src}" controls/>\n`;
      }
      if (!resource.embed && !$util.local_file_exists(resource.dst)) {
        await resource.copy(resource.dst);
        Logger.copy(resource.dst);
      }
    } break;
    case "application": {
      const type = `${mime_type.type}/${mime_type.subtype}`;
      const src = resource.embed ? await resource.file.data_url() : resource.web_friendly_dst;
      if (dst_element.tagName === "EMBED") {
        dst_element.setAttribute("type", type);
        dst_element.setAttribute("src", src);
      } else {
        dst_element.innerHTML += `<embed type="${type}" src="${src}" />\n`;
      }
      if (!resource.embed && !$util.local_file_exists(resource.dst)) {
        await resource.copy(resource.dst);
        Logger.copy(resource.dst);
      }
    } break;
    default:
      throw new $util.BunnyError(`[process_resource] Unsupported resource type: ${resource.src}`);
  }
}


async function process_hard_coded_resources(document: HTMLElement, page: Page, config: AppConfig) {
  for (const element of document.querySelectorAll("[src], [href]:not(a)")) {
    const src_or_href = element.getAttribute("src") ?? element.getAttribute("href") ?? "";

    if ($util.is_data_url(src_or_href)) {
      continue;
    }

    const embed = typeof element.getAttribute("data-do-not-embed") === "undefined";
    const resource = await $util.LazyResource.from({embed: embed, url: src_or_href}, page, config);
    const mime_type = $util.parse_file_mime_type(resource.src).unwrap();
    const url_attribute = element.tagName === "LINK" ? "href" : "src";

    element.setAttribute("type", `${mime_type.type}/${mime_type.subtype}`);

    if (embed) {
      const data_url = await $util.url_to_base64_data_url(resource.src);
      element.setAttribute(url_attribute, data_url);
    }

    else {
      if (resource.is_remote) {
        throw new $util.BunnyError(`[process_hard_coded_resources] Cannot copy remote file and not embed it: ${resource.src}`);
      }
      element.setAttribute(url_attribute, resource.web_friendly_dst);
      if (!$util.local_file_exists(resource.dst)) {
        await resource.copy(resource.dst);
        Logger.copy(resource.dst);
      }
    }

    switch (mime_type.type) {
      case "application":
        element.tagName = "EMBED";
        break;
      case "audio":
        element.tagName = "AUDIO";
        element.setAttribute("controls", "");
        break;
      case "image":
        element.tagName = "IMG";
        break;
      case "video":
        element.tagName = "VIDEO";
        element.setAttribute("controls", "");
        break;
      default:
        throw new $util.BunnyError(`[process_hard_coded_resources] Unsupported resource mime type: ${resource.src}`);
    }
  }
}


export function prefix_relative_urls(html: string, prefix: string) {
  // embed and data_url page functions
  html = html.replaceAll(/\{\{\s*(?:embed|data_url)\s+(.*?)\s*\}\}/g, (full_match, url) => {
    if ($util.is_remote_url(url)) {
      return full_match;
    }
    return full_match.replace(url, $path.join(prefix, url));
  });
  // href="" and src=""
  html = html.replace(/\b(?:href|src)="(.+?)"\s*"?/g, (full_match, url) => {
    if ($util.is_remote_url(url)) {
      return full_match;
    }
    return full_match.replace(url, $path.join(prefix, url));
  });
  return html;
}
