import { Async as A } from './deps/jazzi/mod.ts'
import type { Async, AsyncUIO as UIO } from './deps/jazzi/async-type.ts'

export interface HandleEnv { 
    request: Request,
}

export type Handle = Async<HandleEnv, never, Response>

type CommonConfig = {
    port: number
    handle: Handle
    hostname?: string
}

type Retry = { type: "retry" }
type End = { type: "end" }
type ErrorResolution = Retry | End

export const ErrorResolutions = {
    retry: () => ({ type: "retry" } as ErrorResolution),
    end: () => ({ type: "end" } as ErrorResolution)
} as const

export interface HTTPConfig extends CommonConfig {
    onError?: (err: unknown) => void
    onConnectionError?: (err: unknown, res: typeof ErrorResolutions) => ErrorResolution | Promise<ErrorResolution>
}

export interface HTTPSConfig extends HTTPConfig {
    certFile: string,
    keyFile: string,
}

export type HttpServer = Async<HTTPConfig, unknown, void>
export type HttpsServer = Async<HTTPSConfig, unknown, void>

const handleConnection = async (connection: Deno.Conn, handle: Handle, onError?: (err: unknown) => void) => {
    const http = Deno.serveHttp(connection);
    try {
        for await(const reqEvent of http){
            await reqEvent.respondWith(
                handle.run({
                    request: reqEvent.request
                })
            )
        }
    } catch(e) {
        onError?.(e);
    }
}

const internalMakeListener = (config: HTTPConfig | HTTPSConfig) => {
    if( "certFile" in config ){
        const { certFile, keyFile, port, hostname } = config
        return Deno.listenTls({ certFile, keyFile, port, hostname })
    } else {
        const { port, hostname } = config
        return Deno.listen({ port, hostname })
    }
}

const internalMakeServer = <T extends "tls" | "" = "">() => (): T extends "tls" ? HttpsServer : HttpServer => A.from(
    async (config: HTTPConfig | HTTPSConfig) => {
        const server = internalMakeListener(config);
        const { handle, onError, onConnectionError } = config
        let running = true;
        while(running){
            try {
                const connection = await server.accept();
                handleConnection(connection, handle, onError);
            } catch(e) {
                const resolution = await onConnectionError?.(e, ErrorResolutions);
                if( resolution?.type === "end" ){
                    running = false;
                    server.close();
                }
            }
        }
    }
)

export const makeServer = internalMakeServer()

export const makeTLSServer = internalMakeServer<"tls">()

export const makeHandle = (fn: (req: Request) => Response | Promise<Response>) => A.pure({
    handle: A.from(({ request }: HandleEnv) => Promise.resolve(fn(request)))
})

export const withConfig = <R>(config: UIO<R>) => <E,A>(self: Async<R,E,A>) => config.provideTo(self)

export const listen = (msg?: string, logger=console.log) => <E,A>(self: Async<unknown, E, A>) => A
    .of(() => (msg?.length ?? 0) > 0 && logger(msg))
    .zipRight(self)
    .run()