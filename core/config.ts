import { Async as A } from './deps/jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from './deps/jazzi/async-type.ts'
import type { Router } from './router.ts'
import { makeHandle, ErrorResolutions, ErrorResolution, HandleEnv } from './server.ts'

const unifyType = <T>(x: T) => x as { [P in keyof T]: T[P] }

const simplify = <R,E,A>(self: Async<R,E,A>) => self.map(unifyType)

export const makeConfig = () => A.Success({})

export const withPort = (port: number) => <R,E,A>(self: Async<R,E,A>) => 
    self.map(a => ({ ...a, port } as { [P in keyof A | "port" ]: P extends keyof A ? A[P] : number }))

export const withRouter = (routerAsync: UIO<Router>) => <R,E,A>(self: Async<R,E,A>) => routerAsync
    .chain((router) => 
        self.zipWith(
            makeHandle((req) => router.handle(req)), (a,b) => ({...a,...b})
        )
    ) as Async<R,E, { [P in keyof A | "handle"]: P extends keyof A ? A[P] : Async<HandleEnv, unknown, Response>}>

export const withError = (onError: (e: unknown) => void) => <A>(self: UIO<A>) => 
    self.map(c => ({ ...c, onError }))['|>'](simplify)

export const withCertificate = (data: { certFile: string, keyFile: string }) => <A>(self: UIO<A>) => 
    self.map(c => ({ ...c, ...data } as { [P in keyof A | "certFile" | "keyFile"]: P extends keyof A ? A[P] : string }))

export const withConnectionError = (onConnectionError: (e: unknown, r: typeof ErrorResolutions) => ErrorResolution | Promise<ErrorResolution>) => <A>(self: UIO<A>) => 
    self.map(c => ({ ...c, onConnectionError }))['|>'](simplify)

export const withHandle = (fn: (req: Request) => Response | Promise<Response>) => <R,E,A>(self: Async<R,E,A>) => 
    self.map(c => ({ ...c, handle: makeHandle(fn) }))['|>'](simplify)

export const withHttpFallback = (onFallback?: (e: unknown) => void) => <A>(self: UIO<A>) => 
    self.map(c => ({ ...c, fallbackHttp: true, onFallback }))['|>'](simplify)