import { Async as A } from 'jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from 'jazzi/Async/types.ts'
import type { Router } from './router.ts'
import { makeHandle } from './server.ts'

export const makeConfig = () => A.Success({})

export const withPort = (port: number) => <R,E,A>(self: Async<R,E,A>) => self.map(a => ({ ...a, port }))

export const withRouter = (routerAsync: UIO<Router>) => <R,E,A>(self: Async<R,E,A>) => routerAsync
    .chain((router) => self.zipWith(makeHandle((req, server) => router.handle(req, server)), (a,b) => ({...a,...b})))

export const withError = (onError: (e: unknown, server: Deno.Listener) => void) => <A>(self: UIO<A>) => self.map(c => ({ ...c, onError }))