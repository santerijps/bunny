# Bunny

`Bunny` is a static site generator built with TypeScript (utilizing the Bun runtime) for generating truly portable sites.

## Features

- Resources are embedded into the HTML document by default
- Simple, yet powerful template functions
- Layout templates
- Out of the box support for:
  - Sass and Less
  - TypeScript
  - Build-time code highlighting with [`highlight.js`](https://highlightjs.org/)
- Emojis 💩
- Dev server with hot reloading

## Usage

To print app usage, run the `cli` script without arguments:

```txt
Usage: bunny [project-directory] [options...]

bunny: A static site generator for truly portable sites.
All sites work as is online and offline, making them portable by default.

Options:
  --out, -o [directory-path]       The directory to which the converted files should be placed.
  --minify, -m                     Minify the generated HTML documents.
  --watch, -w                      Watch for file changes and refresh the browser page on changes.
```

### Resources

A resource is essentially any file, remote or local, that you want to include in your HTML page. It could be a JavaScript or CSS file, an image, a video, or even a PDF!

In your Markdown page files, you can add resources with the normal HTML syntax. This way you have the most control over the final output. If you do not wish to have the resource file embedded, use the `data-do-not-embed` attribute.

```markdown
<img src="path/to/some/file.png" />
<video src="path/to/other/file.png" data-do-not-embed></video>
<embed src="path/to/some.pdf" />
```

Alternatively, you can add resources in the page meta section. There you can either provide a `url`, or a record of information including the `url`, `target` (optional) and `embed` (optional). The `target` is a CSS selector that will be used to find the element where the resource should be added. `embed` is a boolean value and controls whether the resource should be embedded or not.

```yaml
title: My Home Page
resources:
  - index.js
  - styles.css
  - url: path/to/video.mp4
    target: "#video-container"
    embed: false
```

### Template functions and variables

There are several template functions and variables that can be used in all project files. Template functions follow the format `{{ function_name [arg] }}`, and variables `$variable_name`.

|Function|Arguments|Description|Example|
|---|---|---|---|
|`embed`|`src`|Embed the contents of the file referenced by `src`. `src` can be a local file path (relative or absolute) or a remote URL. | `{{ embed ./footer.html }}` |
|`data_url`|`src`|Convert the file referenced by `src` into a data url. This is useful when embedding favicons, videos, PDFs etc. | `{{ data_url https://via.placeholder.com/600/92c952 }}` |

| Variable | Description |
|---|---|
|`slot`|Used in `layout` files to indicate where the page file content should be inserted. |
|`title`|Page title, as defined in `PageMeta.title`. Can be used in `layout` files to define the document title of each page.|

## Data model

```ts
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
```

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/cli.ts
```

This project was created using `bun init` in bun v1.1.3. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Windows setup

Create a Powershell script and add it to PATH:

```bash
echo bun path/to/cli.ts $args > bunny.ps1
```

## TODO

- Features
  - Build a showdown.js extension for resources that should not be embedded
- Developer experience
  - Figure out what resource dependencies each page has and make a map of it
    - This can be used to figure out which file needs to be reloaded if a dependency is modified
- Optimization
  - Remote resource caching
