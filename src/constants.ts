import $path from "node:path";
import $process from "node:process";
import $showdown from "showdown";
import $minify from "minify";
import $typescript from "typescript";

export const DEV_SERVER_WS_PATH = "/bunny-ws";
export const WORKING_DIRECTORY = $process.cwd();

export const BUNNY_ROOT_DIR = $path.dirname(import.meta.dir);
export const HLJS_STYLES_DIR = $path.join(BUNNY_ROOT_DIR, "node_modules", "highlight.js", "styles");

export const SHOWDOWN_OPTIONS: $showdown.ConverterOptions = {
  backslashEscapesHTMLTags: true,
  completeHTMLDocument: false,
  customizedHeaderId: false,
  disableForced4SpacesIndentedSublists: false,
  ellipsis: true,
  emoji: true,
  encodeEmails: false,
  extensions: undefined,
  ghCodeBlocks: true,
  ghCompatibleHeaderId: true,
  ghMentions: false,
  ghMentionsLink: undefined,
  headerLevelStart: undefined,
  literalMidWordUnderscores: true,
  metadata: true,
  noHeaderId: false,
  omitExtraWLInCodeBlocks: true,
  openLinksInNewWindow: false,
  parseImgDimensions: true,
  prefixHeaderId: false,
  rawHeaderId: undefined,
  rawPrefixHeaderId: undefined,
  requireSpaceBeforeHeadingText: true,
  simpleLineBreaks: false,
  simplifiedAutoLink: false,
  smartIndentationFix: false,
  smoothLivePreview: true,
  splitAdjacentBlockquotes: undefined,
  strikethrough: true,
  tables: true,
  tablesHeaderId: true,
  tasklists: true,
  underline: true,
};

export const MINIFY_OPTIONS: $minify.Options = {
  html: {
    collapseBooleanAttributes: true,
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeOptionalTags: false,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    removeTagWhitespace: false,
    trimCustomFragments: true,
    useShortDoctype: true,
  },
};

export const TYPESCRIPT_OPTIONS: $typescript.CompilerOptions = {
  allowJs: true,
};

export const DEFAULT_HTML_LAYOYUT = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title</title>
  </head>
  <body>
    {{slot}}
  </body>
</html>`;
