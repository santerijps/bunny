import * as $util from ".";

export default class Logger {
  public static info(operation: string, message: string) {
    console.warn(`[${$util.timestamp()}] ${operation} ${message}`);
  }

  public static error(file_path: string, msg: string) {
    console.error(`[${$util.timestamp()}] ERROR ${msg} (page file: ${file_path})`);
  }

  public static copy(url: string) {
    Logger.info("RESOURCE", url);
  }

  public static write(url: string) {
    Logger.info("PAGE", url);
  }

  public static minify(url: string) {
    Logger.info("MINIFY", url);
  }

  public static http_ok(method: string, url: string) {
    Logger.info("HTTP", `${method} 200 ${url}`);
  }

  public static http_not_found(method: string, url: string) {
    Logger.info("HTTP", `${method} 404 ${url}`);
  }
}
