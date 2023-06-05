import * as R from './router.ts';
import { appendHeader } from './utils.ts';

export type CorsConfig = {
    origin: string,
    methods: R.Method[],
    headers?: string[],
}

export const defaultConfig: CorsConfig = {
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
}

const preflight = (
    path: string,
    _config: Partial<CorsConfig> = defaultConfig
) => R.options(path, (req, r) => {
    const { raw } = req

    const config = {
        ...defaultConfig,
        ..._config,
        headers: _config.headers ?? raw.headers.get("Access-Control-Request-Headers")?.split(","),
    }

    const headers: Record<string, string> = {
        "Access-Control-Allow-Origin": config.origin,
        "Access-Control-Allow-Methods": config.methods.join(", ")
    }

    if( config.headers ){
        headers[ "Access-Control-Allow-Headers"] = config.headers.join(",")
    }


    return r.respond("", { headers });
})

/**
 * Adds a preflight handler for a given path and adds Access-Control-Allow-Origin 
 * header to the given methods on said path.
 */
export const policy = (path: string, _config: Partial<CorsConfig> = defaultConfig) => (router: R.RouterAsync) => {
    const config = { ...defaultConfig, ..._config}
    const pre = router['|>'](preflight(path, config))
    
    return config.methods.reduce((router, method) => {
        return router['|>'](R.useRoute(
            method, 
            path, 
            (_, r) => r.continueWith(appendHeader("Access-Control-Allow-Origin", config.origin)))
        )
    }, pre);
}

/**
 * Single path, single method CORS policy for an async route
 */
export const useAsync = (
    method: R.Method, 
    path: string, 
    handle: R.AsyncHandle,
    _config: Omit<Partial<CorsConfig>, "methods"> = defaultConfig
) => (router: R.RouterAsync) => {
    const config: CorsConfig = { 
        ...defaultConfig, 
        ..._config,
        methods: [method]
    };
    return router
        ['|>'](policy(path, config))
        ['|>'](R.useAsync(method, path, handle))
}

/**
 * Single path, single method CORS policy for a route
 */
export const useRoute = (
    method: R.Method, 
    path: string, 
    handle: R.RouteHandle,
    _config: Omit<Partial<CorsConfig>, "methods"> = defaultConfig
) => (router: R.RouterAsync) => {
    const config: CorsConfig = { 
        ...defaultConfig, 
        ..._config,
        methods: method !== "*" ? [method] : defaultConfig.methods
    };
    return router
        ['|>'](policy(path, config))
        ['|>'](R.useRoute(method, path, handle))
}

const methodHandle = 
    (method: R.Method) => 
    (path: string, handle: R.RouteHandle, _config: Omit<Partial<CorsConfig>, "methods"> = defaultConfig) =>
        useRoute(method, path, handle, _config) 

/**
 * Adds a handler with CORS to a path that triggers for GET requests
 */
export const get = methodHandle("GET")
/**
 * Adds a handler with CORS to a path that triggers for HEAD requests
 */
export const head = methodHandle("HEAD")
/**
 * Adds a handler with CORS to a path that triggers for POST requests
 */
export const post = methodHandle("POST")
/**
 * Adds a handler with CORS to a path that triggers for PUT requests
 */
export const put = methodHandle("PUT")
/**
 * Adds a handler with CORS to a path that triggers for DELETE requests
 */
export const del = methodHandle("DELETE")
/**
 * Adds a handler with CORS to a path that triggers for CONNECT requests
 */
export const connect = methodHandle("CONNECT")
/**
 * Adds a handler with CORS to a path that triggers for OPTIONS requests
 */
export const options = methodHandle("OPTIONS")
/**
 * Adds a handler with CORS to a path that triggers for TRACE requests
 */
export const trace = methodHandle("TRACE")
/**
 * Adds a handler with CORS to a path that triggers for PATCH requests
 */
export const patch = methodHandle("PATCH")
/**
 * Adds a handler with CORS to a path that triggers for all kinds requests
 */
export const all = methodHandle("*")