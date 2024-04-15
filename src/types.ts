import type { LazyResource } from "./util";

export interface ResolvedSource {
  url: string;
  is_remote: boolean;
}

export type Resource = string | {
  url?: string;     // The resource URL (remote, or local file path)
  target?: string;  // The target HTML query selector where the resource will be placed
  embed?: boolean;  // Whether the resource should be embedded into the HTML document
};

export interface PageMeta {
  favicon?: Resource;
  hljs?: boolean | string;
  layout?: string;
  resources?: Resource[];
  title?: string;
}

export interface ResolvedPageMeta {
  favicon?: LazyResource;
  hljs: boolean | string;
  layout?: LazyResource;
  resources: LazyResource[];
  title: string;
}

export interface AppConfig {
  src_dir_path: string;   // Project directory path
  dst_dir_path: string;   // Output directory path (will be created)
  minify: boolean;        // Minify the resulting HTML documents
  watch: boolean;         // Start Bunny in watch mode by running a dev server
  port: number;           // Port of the dev server
}

export interface Page {
  src: string;      // src/index.page.md
  dst: string;      // dst/index.html
  ext: string;      // .md
  src_dir: string;  // src
  dst_dir: string;  // dst
}
