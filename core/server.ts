import { Async as A } from 'jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from 'jazzi/Async/types.ts'
import type { Router } from './router.ts'

export interface HandleEnv { 
    request: Request, 
    server: Deno.Listener
}

export type Handle = Async<HandleEnv, never, Response>

export interface ServerConfig {
    port: number
    handle: Handle
}

export type HttpServer = Async<ServerConfig, unknown, void>

export const makeServer = (): HttpServer => A.from(async ({ port, handle }: ServerConfig) => {
    const server = Deno.listen({ port });
    for await(const connection of server){
        const http = Deno.serveHttp(connection);
        for await(const reqEvent of http){
            await reqEvent.respondWith(
                handle.run({ 
                    request: reqEvent.request, 
                    server 
                })
            )
        }
    }
})

export const makeConfig = () => A.Success({})

export const makeHandle = (fn: (req: Request, server: Deno.Listener) => Response | Promise<Response>) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => Promise.resolve(fn(request, server)))
})

export const makeAsyncHandle = (fn: (req: Request, server: Deno.Listener) => Promise<Response>) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => fn(request, server))
})

export const makeSyncHandle = (fn: (req: Request, server: Deno.Listener) => Response) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => Promise.resolve(fn(request, server)))
})

export const withRouter = (routerAsync: UIO<Router>) => <R,E,A>(self: Async<R,E,A>) => routerAsync
    .chain((router) => self.zipWith(makeHandle((req, server) => router.handle(req, server)), (a,b) => ({...a,...b})))

export const withConfig = (config: UIO<ServerConfig>) => <E,A>(self: Async<ServerConfig,E,A>) => config.provideTo(self)

export const withPort = (port: number) => <R,E,A>(self: Async<R,E,A>) => self.map(a => ({ ...a, port }))

export const listen = (msg?: string) => <E>(self: Async<unknown, E, void>) => A
    .of(() => (msg?.length ?? 0) > 0 && console.log(msg))
    .zipRight(self)
    .run()