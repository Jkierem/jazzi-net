import { Async as A } from './deps/jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from './deps/jazzi/async-type.ts'

export interface HandleEnv { 
    request: Request, 
    server: Deno.Listener
}

export type Handle = Async<HandleEnv, never, Response>

export interface HTTPConfig {
    port: number
    handle: Handle
    hostname?: string
    onError?: (err: unknown, server: Deno.Listener) => void
}

export interface HTTPSConfig extends HTTPConfig {
    certFile: string,
    keyFile: string,
}

export type HttpServer = Async<HTTPConfig, unknown, void>
export type HttpsServer = Async<HTTPSConfig, unknown, void>

const handleConnection = async (server: Deno.Listener, connection: Deno.Conn, handle: Handle) => {
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

export const makeServer = (): HttpServer => A.from(async ({ port, handle, hostname="0.0.0.0", onError }: HTTPConfig) => {
    const server = Deno.listen({ port, hostname });
    for await(const connection of server){
        try {
            handleConnection(server, connection, handle)
        } catch(e) {
            onError?.(e, server)
        }
    }
})

export const makeTLSServer = (): HttpsServer => A.from(async ({ port, handle, hostname="0.0.0.0", onError, certFile, keyFile }: HTTPSConfig) => {
    const server = Deno.listenTls({ 
        port,
        hostname,
        certFile,
        keyFile
    });
    for await(const connection of server){
        try {
            handleConnection(server, connection, handle)
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

export const withConfig = <R>(config: UIO<R>) => <E,A>(self: Async<R,E,A>) => config.provideTo(self)

export const listen = (msg?: string) => <E,A>(self: Async<unknown, E, A>) => A
    .of(() => (msg?.length ?? 0) > 0 && console.log(msg))
    .zipRight(self)
    .run()

export const onConnectionError = <E0,A0>(fn: (e: unknown) => Async<unknown,E0,A0>) => <E,A>(self: Async<unknown, E, A>) => 
    self.recover(fn)