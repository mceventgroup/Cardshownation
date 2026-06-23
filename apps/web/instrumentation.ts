export async function register() {}

export async function onRequestError(
  error: { digest?: string; message?: string },
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  console.error("[request-error]", {
    digest: error.digest,
    message: error.message,
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
  });
}
