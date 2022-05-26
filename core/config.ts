import { Async as A } from './deps/jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from './deps/jazzi/async-type.ts'
import type { Router } from './router.ts'
import { makeHandle, ErrorResolutions, ErrorResolution } from './server.ts'

export const makeConfig = () => A.Success({})

export const withPort = (port: number) => <R,E,A>(self: Async<R,E,A>) => self.map(a => ({ ...a, port }))

export const withRouter = (routerAsync: UIO<Router>) => <R,E,A>(self: Async<R,E,A>) => routerAsync
    .chain((router) => self.zipWith(makeHandle((req) => router.handle(req)), (a,b) => ({...a,...b})))

export const withError = (onError: (e: unknown) => void) => <A>(self: UIO<A>) => self.map(c => ({ ...c, onError }))

export const withCertificate = (data: { certFile: string, keyFile: string }) => <A>(self: UIO<A>) => self.map(c => ({ ...c, ...data }))

export const withConnectionError = (onConnectionError: (e: unknown, r: typeof ErrorResolutions) => ErrorResolution | Promise<ErrorResolution>) => <A>(self: UIO<A>) => 
    self.map(c => ({ ...c, onConnectionError }))

export const withHandle = (fn: (req: Request) => Response | Promise<Response>) => <R,E,A>(self: Async<R,E,A>) => 
    self.map(c => ({ ...c, handle: makeHandle(fn) }))

export const withHttpFallback = (onFallback?: (e: unknown) => void) => <A>(self: UIO<A>) => self.map(c => ({ ...c, fallbackHttp: true, onFallback }))