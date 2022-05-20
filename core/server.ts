import { Async as A } from './deps/jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from './deps/jazzi/async-type.ts'

export interface HandleEnv { 
    request: Request, 
    server: Deno.Listener
}

export type Handle = Async<HandleEnv, never, Response>

type CommonConfig = {
    port: number
    handle: Handle
    hostname?: string
}

export interface HTTPConfig extends CommonConfig {
    onError?: (err: unknown, server: Deno.Listener) => void
    onConnectionError?: (err: unknown, server: Deno.Listener) => void
}

export interface HTTPSConfig extends HTTPConfig {
    certFile: string,
    keyFile: string,
}

export type HttpServer = Async<HTTPConfig, unknown, void>
export type HttpsServer = Async<HTTPSConfig, unknown, void>

const handleConnection = async (server: Deno.Listener, connection: Deno.Conn, handle: Handle, onError?: (err: unknown, server: Deno.Listener) => void) => {
    const http = Deno.serveHttp(connection);
    try {
        for await(const reqEvent of http){
            await reqEvent.respondWith(
                handle.run({
                    request: reqEvent.request, 
                    server 
                })
            )
        }
    } catch(e) {
        onError?.(e, server);
    }
}

export const makeServer = (): HttpServer => A.from(async ({ port, handle, hostname="0.0.0.0", ...errors}: HTTPConfig) => {
    const server = Deno.listen({ port, hostname });
    try {
        for await(const connection of server){
            handleConnection(server, connection, handle, errors.onError)
        }
    } catch(e) {
        errors.onConnectionError?.(e, server);
    }
})

export const makeTLSServer = (): HttpsServer => A.from(async ({ port, handle, hostname="0.0.0.0", certFile, keyFile, ...errors }: HTTPSConfig) => {
    const server = Deno.listenTls({ 
        port,
        hostname,
        certFile,
        keyFile
    });
    try {
        for await(const connection of server){
            handleConnection(server, connection, handle, errors.onError)
        }
    } catch(e) {
        errors.onConnectionError?.(e, server);
    }
})

export const makeHandle = (fn: (req: Request, server: Deno.Listener) => Response | Promise<Response>) => A.pure({
    handle: A.from(({ request, server }: HandleEnv) => Promise.resolve(fn(request, server)))
})

export const withConfig = <R>(config: UIO<R>) => <E,A>(self: Async<R,E,A>) => config.provideTo(self)

export const listen = (msg?: string, logger=console.log) => <E,A>(self: Async<unknown, E, A>) => A
    .of(() => (msg?.length ?? 0) > 0 && logger(msg))
    .zipRight(self)
    .run()