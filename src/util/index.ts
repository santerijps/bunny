import * as $constants from "../constants";
import type { AppConfig, Page, PageMeta, ResolvedPageMeta, ResolvedSource, Resource } from "../types";
import $mime from "mime-types";
import $fs from "node:fs";
import $path from "node:path";

export function get_or_default(object: Record<string, any>, keys: string[], default_value: any) {
  for (const key of keys) {
    if (typeof object[key] !== "undefined") {
      return object[key];
    }
  }
  return default_value;
}

export function is_remote_url(url: string): boolean {
  return url.match(/^https?:\/\//) !== null;
}

export function is_video(url: string) {
  const result = parse_file_mime_type(url);
  return result.ok && result.unwrap().type === "video";
}

export function is_audio(url: string) {
  const result = parse_file_mime_type(url);
  return result.ok && result.unwrap().type === "audio";
}

export function is_full_html_document(html: string) {
  return html.match(/<html(?:\s+.+)?>.*?<\/html>/s) !== null;
}

export function is_data_url(url: string) {
  return url.match(/^data\:\w+\/\w+\;base64\,.+$/) !== null;
}

export function local_file_exists(file_path: string) {
  return $fs.existsSync(file_path);
}

interface ResultOptions<T> {
  readonly data?: T;
  readonly error?: Error;
}

class Result<T> {
  private readonly data?: T;
  private readonly error?: any;
  public readonly ok: boolean;

  private constructor(options: ResultOptions<T>) {
    this.data = options.data;
    this.error = options.error;
    this.ok = typeof this.data !== "undefined";
  }

  public static Ok<T>(data: T) {
    return new Result({data});
  }

  public static Err<T>(error?: any) {
    if (typeof error === "undefined") {
      error = new Error("Unwrap failed");
    }
    return new Result<T>({error});
  }

  public unwrap() {
    if (!this.ok) {
      throw this.error;
    }
    return this.data as T;
  }
}

type FileType =
  | "application"
  | "audio"
  | "example"
  | "font"
  | "image"
  | "model"
  | "text"
  | "video";

interface MimeType {
  type: FileType;
  subtype: string;
}

export function parse_file_mime_type(url: string): Result<MimeType> {
  const extension = $path.extname(url);
  const lookup_result = $mime.lookup(extension);
  if (lookup_result === false) {
    return Result.Err(`Mime type lookup failed for url: ${url}`);
  }
  const match = lookup_result.match(/(\w+)\/(.+)/);
  if (match === null) {
    return Result.Err(`Failed to match type and subtype in mime type: ${lookup_result}`);
  }
  return Result.Ok({type: match[1] as FileType, subtype: match[2]});
}

export function timestamp() {
  const zero_pad = (x: number) => (x < 10 ? "0" : "") + x.toString();
  const d = new Date();
  return `${zero_pad(d.getHours())}:${zero_pad(d.getMinutes())}:${zero_pad(d.getSeconds())}`;
}

export function relative_path_to_absolute(relative_path: string, working_directory: string) {
  // Remove trailing path separators
  relative_path = relative_path.replace(/[\/\\]+$/, "");
  if ($path.isAbsolute(relative_path)) {
    return $path.normalize(relative_path);
  } else {
    return $path.normalize($path.join(working_directory, relative_path));
  }
}

export function resolve_source(url: string, working_directory: string): ResolvedSource {
  if (is_remote_url(url)) {
    return {is_remote: true, url};
  } else if (is_data_url(url)) {
    return {is_remote: false, url};
  } else {
    return {is_remote: false, url: relative_path_to_absolute(url, working_directory)};
  }
}

export function resolve_src_location(src: string, working_directory: string) {
  if (is_remote_url(src)) {
    return src;
  } else {
    return relative_path_to_absolute(src, working_directory);
  }
}

export async function get_source_file_extension(source: ResolvedSource) {
  if (source.is_remote) {
    const response = await fetch(source.url, {method: "HEAD"});
    if (!response.ok) {
      throw new BunnyError(`[get_source_file_extension] ${response.status} ${response.statusText} ${source.url}`);
    }
    const content_type = response.headers.get("Content-Type") ?? "text/plain";
    const extension = $mime.extension(content_type);
    return extension === false ? ".txt" : `.${extension}`;
  } else {
    const extension = $path.extname(source.url);
    return extension.length > 0 ? extension : ".txt";
  }
}

export function resolve_default_resource_target(ext: string) {
  switch (ext) {
    case ".css":
    case ".scss":
    case ".less":
      return "head";
    default:
      return "body";
  }
}

export function is_page_file(file_path: string) {
  return file_path.match(/.+?\.page\.\w+$/) !== null;
}

export function resolve_page(absolute_file_path: string, config: AppConfig): Page {
  const dst_file_path = absolute_file_path.replace(/(.+?)\.page\.\w+$/, (_, name) => {
    return `${name}.html`;
  }).replace(config.src_dir_path, config.dst_dir_path);
  return {
    src: absolute_file_path,
    dst: dst_file_path,
    ext: $path.extname(absolute_file_path),
    src_dir: $path.dirname(absolute_file_path),
    dst_dir: $path.dirname(dst_file_path),
  };
}

export async function resolve_page_meta(meta: PageMeta, page: Page, config: AppConfig): Promise<ResolvedPageMeta> {
  const hljs = meta.hljs ?? false;
  const title = meta.title ?? "";
  const layout = meta.layout ? await LazyResource.from({url: meta.layout}, page, config) : undefined;
  const favicon = meta.favicon ? await LazyResource.from(meta.favicon, page, config) : undefined;
  const resources: LazyResource[] = [];
  if (Array.isArray(meta.resources)) {
    for (const resource of meta.resources) {
      const lazy_resource = await LazyResource.from(resource, page, config);
      resources.push(lazy_resource);
    }
  }
  return {hljs, title, layout, favicon, resources};
}

type EventListener = () => void;

export class EventService {
  private listeners: EventListener[] = [];
  public subscribe(event_listener: EventListener) {
    this.listeners.push(event_listener);
  }
  public unsubscribe(event_listener: EventListener) {
    this.listeners = this.listeners.filter((x) => x !== event_listener);
  }
  public publish() {
    for (const event_listener of this.listeners) {
      event_listener();
    }
  }
}

async function read_local_file(src: string) {
  const file = Bun.file(src);
  if (await file.exists() === false) {
    throw new BunnyError(`[read_local_file] File not found: ${src}`);
  }
  return new Response(file);
}

async function read_remote_file(src: string) {
  const response = await fetch(src, { method: "GET" });
  if (!response.ok) {
    throw new BunnyError(`[read_remote_file] ${response.status} ${response.statusText} ${src}`)
  }
  return response;
}

export async function read_file(src: string) {
  if (is_remote_url(src)) {
    return await read_remote_file(src);
  } else {
    return await read_local_file(src);
  }
}

export async function read_file_text(url: string) {
  const response = await read_file(url);
  return await response.text();
}

export async function write_file(dst: string, text: string) {
  await Bun.write(dst, text, {createPath: true});
}

export async function copy_file(src: string, dst: string) {
  const file = Bun.file(src);
  await Bun.write(dst, file);
}

export async function url_to_base64_data_url(url: string) {
  if (is_remote_url(url)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BunnyError(`[url_to_base64_data_url] ${response.status} ${response.statusText} ${url}`);
    }
    const file_type = response.headers.get("Content-Type") ?? "text/plain";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${file_type};base64,${base64}`;
  } else {
    const file = Bun.file(url);
    if (!(await file.exists())) {
      throw new BunnyError(`[url_to_base64_data_url] File not found: ${url}`);
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${file.type};base64,${base64}`;
  }
}

export function replace_extension(url: string, ext: string) {
  const regex = new RegExp("\\.\\w+$", "m");
  return url.replace(regex, ext);
}

export function to_web_friendly_url(path: string, config: AppConfig) {
  path = path.replace(config.dst_dir_path, "").replaceAll("\\", "/");
  return $path.join(".", path);
}

interface LazyResourceOptions {
  config: AppConfig;
  embed: boolean;
  file: LazyFile;
  page: Page;
  target: string;
}

export class LazyResource {
  private readonly config: AppConfig;
  public readonly embed: boolean;
  public readonly file: LazyFile;
  private readonly page: Page;
  public readonly target: string;

  public constructor(config: LazyResourceOptions) {
    this.config = config.config;
    this.embed = config.embed;
    this.file = config.file;
    this.page = config.page;
    this.target = config.target;
  }

  public static async from(resource: Resource, page: Page, config: AppConfig) {
    if (typeof resource === "string") {
      const embed = true;
      const file = new LazyFile(resource, page.src_dir);
      const target = resolve_default_resource_target(file.extension);
      return new LazyResource({config, embed, file, page, target});
    } else {
      const embed = typeof resource.embed === "boolean" ? resource.embed : true;
      const url = typeof resource.url === "string" ? resource.url : "";
      if (url.length === 0) {
        throw new BunnyError(`[LazyResource.from] Resource URL is missing: ${page.src}`);
      }
      const file = new LazyFile(url, page.src_dir);
      const target = typeof resource.target === "string" ? resource.target : resolve_default_resource_target(file.extension);
      return new LazyResource({config, embed, file, page, target});
    }
  }

  public get is_local() {
    return this.file.is_local;
  }

  public get is_remote() {
    return this.file.is_remote;
  }

  public get src() {
    return this.file.url;
  }

  public get dst() {
    if (this.embed) {
      throw new BunnyError(`[LazyResource.dst] Cannot get dst of an embedded resource: ${this.src}`);
    }
    if (this.is_remote) {
      throw new BunnyError(`[LazyResource.dst] Cannot get dst of a remote resource: ${this.src}`);
    }
    return resolve_source(this.src.replace(this.config.src_dir_path, this.config.dst_dir_path), this.page.src_dir).url;
  }

  public get web_friendly_dst() {
    if (!this.embed && this.file.is_local) {
      return to_web_friendly_url(this.dst, this.config);
    } else {
      return "";
    }
  }

  public async copy(dst_file_path: string, overwrite = true) {
    await this.file.copy(dst_file_path);
  }

  public async read_text() {
    return await this.file.read_text();
  }
}

export class LazyFile {
  private cache: Record<string, any>;
  private source: ResolvedSource;

  public constructor(url: string, working_directory = $constants.WORKING_DIRECTORY) {
    this.cache = {};
    this.source = resolve_source(url, working_directory);
  }

  public get url() {
    return this.source.url;
  }

  public get is_remote(): boolean {
    return this.source.is_remote;
  }

  public get is_local() {
    return !this.is_remote;
  }

  public get extension() {
    return $path.extname(this.url);
  }

  public async exists(): Promise<boolean> {
    if (typeof this.cache["exists"] === "undefined") {
      if (this.is_remote) {
        const response = await fetch(this.source.url, {method: "HEAD"});
        this.cache["exists"] = response.ok;
      } else {
        const file = Bun.file(this.source.url);
        this.cache["exists"] = await file.exists();
      }
    }
    return this.cache["exists"];
  }

  public async get_type(): Promise<string> {
    if (typeof this.cache["get_type"] === "undefined") {
      if (this.is_remote) {
        const response = await fetch(this.source.url, {method: "HEAD"});
        this.cache["get_type"] = response.headers.get("Content-Type") ?? "text/plain";
      } else {
        this.cache["get_type"] = $mime.lookup(this.extension) || "text/plain";
      }
    }
    return this.cache["get_type"];
  }

  public async data_url(): Promise<string> {
    if (typeof this.cache["data_url"] === "undefined") {
      this.cache["data_url"] = await url_to_base64_data_url(this.source.url);
    }
    return this.cache["data_url"];
  }

  public async read_text(): Promise<string> {
    if (typeof this.cache["read_text"] === "undefined") {
      this.cache["read_text"] = await read_file_text(this.source.url);
    }
    return this.cache["read_text"];
  }

  public async copy(dst_file_path: string): Promise<Response> {
    if (typeof this.cache["copy"] === "undefined") {
      this.cache["copy"] = await read_file(this.source.url);
    }
    await Bun.write(dst_file_path, this.cache["copy"]);
    return this.cache["copy"];
  }

  public async process_text_and_copy(dst_file_path: string, processor: (text: string) => string | Promise<string>) {
    const text = await this.read_text();
    const processed_text = await processor(text);
    await Bun.write(dst_file_path, processed_text);
    return processed_text;
  }
}

export class BunnyError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = BunnyError.name;
  }
}
