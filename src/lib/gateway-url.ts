const DEFAULT_PROXY_PATH = "/gateway-ws";

interface BrowserLocationLike {
  host: string;
  protocol: string;
}

function getWebSocketOrigin(location: BrowserLocationLike) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}`;
}

export function resolveGatewayWebSocketUrl(
  configuredUrl: string | undefined,
  location: BrowserLocationLike,
) {
  if (!configuredUrl) {
    return `${getWebSocketOrigin(location)}${DEFAULT_PROXY_PATH}`;
  }

  if (configuredUrl.startsWith("/")) {
    return `${getWebSocketOrigin(location)}${configuredUrl}`;
  }

  return configuredUrl;
}

export function getDefaultGatewayProxyPath() {
  return DEFAULT_PROXY_PATH;
}
