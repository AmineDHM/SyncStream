{ pkgs }: {
  deps = [
    pkgs.chromium
    pkgs.nodejs-18_x
  ];
  env = {
    PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";
  };
}
