import * as A from "https://deno.land/x/jazzi@v4.0.0/Async/mod.ts"
import type { Router } from './router.ts'
import { makeHandle, ErrorResolutions, ErrorResolution } from './server.ts'
import { Config } from "./server.ts"

/**
 * Creates an empty configuration
 */
export const makeConfig = () => A.Succeed({} as Config)
/**
 * Sets a port on the configuration
 * @param port 
 */
export const withPort = (port: number) => <R,E,A>(self: A.Async<R,E,A>) => self
    ["|>"](A.map(a => ({ ...a, port } as unknown as Config)))
/**
 * Sets a router as handle on the configuration
 * @param router
 */
export const withRouter = (routerAsync: A.AsyncUIO<Router>) => <R,E,A>(self: A.Async<R,E,A>) => routerAsync
    ['|>'](A.chain((router) => {
        return self
            ["|>"](A.zip(makeHandle((req) => router.handle(req))))
            ["|>"](A.map(([a,b]) => ({...a, ...b})))
    }))
    ['|>'](A.map(x => x as unknown as Config))
/**
 * Sets onError callback on the configuration
 * @param onError 
 */
export const withError = (onError: (e: unknown) => void) => <A>(self: A.AsyncUIO<A>) => self
    ['|>'](A.map(c => ({ ...c, onError })))
    ['|>'](A.map(x => x as unknown as Config))

/**
 * Sets certificate information on the configuration. Required if used a HTTPS server
 * @param certificateData 
 * @returns 
 */
export const withCertificate = (data: { certFile: string, keyFile: string }) => <A>(self: A.AsyncUIO<A>) => self
    ['|>'](A.map(c => ({ ...c, ...data })))
    ['|>'](A.map(x => x as unknown as Config))

/**
 * Sets a connection error callback on the configuration
 * @param onConnectionError 
 */
export const withConnectionError = (onConnectionError: (e: unknown, r: typeof ErrorResolutions) => ErrorResolution | Promise<ErrorResolution>) => <A>(self: A.AsyncUIO<A>) => 
    self['|>'](A.map(c => ({ ...c, onConnectionError })))['|>'](A.map(x => x as unknown as Config))

/**
 * Sets the handle function on the configuration
 * @param fn 
 */
export const withHandle = (fn: (req: Request) => Response | Promise<Response>) => <R,E,A>(self: A.Async<R,E,A>) => 
    self
    ['|>'](A.map(c => ({ ...c, handle: makeHandle(fn) })))
    ['|>'](A.map(x => x as unknown as Config))
/**
 * Sets the callback to call when creating a HTTPS server fails. Settings this option enables falling back to HTTP  when HTTPS creation fails.
 * @param onFallback 
 */
export const withHttpFallback = (onFallback?: (e: unknown) => void) => <A>(self: A.AsyncUIO<A>) => 
    self
    ['|>'](A.map(c => ({ ...c, fallbackHttp: true, onFallback })))
    ['|>'](A.map(x => x as unknown as Config))