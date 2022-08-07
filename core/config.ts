import { Async as A } from './deps/jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from './deps/jazzi/async-type.ts'
import type { Router } from './router.ts'
import { makeHandle, ErrorResolutions, ErrorResolution } from './server.ts'
import { simplify } from "./common.ts"

/**
 * Creates an empty configuration
 */
export const makeConfig = () => A.Success({})
/**
 * Sets a port on the configuration
 * @param port 
 */
export const withPort = (port: number) => <R,E,A>(self: Async<R,E,A>) => self.map(a => ({ ...a, port }))['|>'](simplify)
/**
 * Sets a router as handle on the configuration
 * @param router
 */
export const withRouter = (routerAsync: UIO<Router>) => <R,E,A>(self: Async<R,E,A>) => routerAsync
    .chain((router) => self.zipWith(makeHandle((req) => router.handle(req)), (a,b) => ({...a,...b})))
    ['|>'](simplify)
/**
 * Sets onError callback on the configuration
 * @param onError 
 */
export const withError = (onError: (e: unknown) => void) => <A>(self: UIO<A>) => self.map(c => ({ ...c, onError }))['|>'](simplify)
/**
 * Sets certificate information on the configuration. Required if used a HTTPS server
 * @param certificateData 
 * @returns 
 */
export const withCertificate = (data: { certFile: string, keyFile: string }) => <A>(self: UIO<A>) => self.map(c => ({ ...c, ...data }))['|>'](simplify)
/**
 * Sets a connection error callback on the configuration
 * @param onConnectionError 
 */
export const withConnectionError = (onConnectionError: (e: unknown, r: typeof ErrorResolutions) => ErrorResolution | Promise<ErrorResolution>) => <A>(self: UIO<A>) => 
    self.map(c => ({ ...c, onConnectionError }))['|>'](simplify)
/**
 * Sets the handle function on the configuration
 * @param fn 
 */
export const withHandle = (fn: (req: Request) => Response | Promise<Response>) => <R,E,A>(self: Async<R,E,A>) => 
    self.map(c => ({ ...c, handle: makeHandle(fn) }))['|>'](simplify)
/**
 * Sets the callback to call when creating a HTTPS server fails. Settings this option enables falling back to HTTP  when HTTPS creation fails.
 * @param onFallback 
 */
export const withHttpFallback = (onFallback?: (e: unknown) => void) => <A>(self: UIO<A>) => self.map(c => ({ ...c, fallbackHttp: true, onFallback }))['|>'](simplify)