import { Async as A } from 'jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from 'jazzi/Async/types.ts'

export interface HandleEnv { 
    request: Request, 
    server: Deno.Listener
}

export type Handle = Async<HandleEnv, never, Response>

export interface HTTPConfig {
    port: number
    handle: Handle
    onError?: (err: unknown, server: Deno.Listener) => void
}

export type HttpServer = Async<HTTPConfig, unknown, void>

const handleConnectionWithHTTP = async (server: Deno.Listener, connection: Deno.Conn, handle: Handle) => {
    const http = Deno.serveHttp(connection);
    for await(const reqEvent of http){
        reqEvent.respondWith(
            handle.run({
                request: reqEvent.request, 
                server 
            })
        )
    }
}

export const makeHTTP = (): HttpServer => A.from(async ({ port, handle, onError }: HTTPConfig) => {
    const server = Deno.listen({ port });
    for await(const connection of server){
        try {
            handleConnectionWithHTTP(server, connection, handle)
        } catch(e) {
            onError?.(e, server)
        }
    }
})

export const makeHandle = (fn: (req: Request, server: Deno.Listener) => Response | Promise<Response>) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => Promise.resolve(fn(request, server)))
})

export const makeAsyncHandle = (fn: (req: Request, server: Deno.Listener) => Promise<Response>) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => fn(request, server))
})

export const makeSyncHandle = (fn: (req: Request, server: Deno.Listener) => Response) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => Promise.resolve(fn(request, server)))
})

export const withConfig = (config: UIO<HTTPConfig>) => <E,A>(self: Async<HTTPConfig,E,A>) => config.provideTo(self)

export const listen = (msg?: string) => <E,A>(self: Async<unknown, E, A>) => A
    .of(() => (msg?.length ?? 0) > 0 && console.log(msg))
    .zipRight(self)
    .run()

export const onConnectionError = <E0,A0>(fn: (e: unknown) => Async<unknown,E0,A0>) => <E,A>(self: Async<unknown, E, A>) => 
    self.recover(fn)