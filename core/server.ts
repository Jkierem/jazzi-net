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
export type ErrorResolution = Retry | End

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
    fallbackHttp?: boolean,
    onFallback?: (e: unknown) => void
}

export type HttpServer = Async<HTTPConfig, unknown, HTTPConfig>
export type HttpsServer = Async<HTTPSConfig, unknown, HTTPSConfig>
export type Server = Async<unknown, unknown, HTTPConfig | HTTPSConfig>

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
        const { certFile, keyFile, port, hostname, fallbackHttp, onFallback } = config
        try {
            return Deno.listenTls({ certFile, keyFile, port, hostname })
        } catch(e) {
            if( fallbackHttp ){
                onFallback?.(e);
                return Deno.listen({ port, hostname });
            }
            throw e;
        }
    } else {
        const { port, hostname } = config
        return Deno.listen({ port, hostname })
    }
}
/**
 * Creates a HTTP server
 */
export const makeServer = () =>  A.of((_: HTTPConfig) => _)
/**
 * Creates a HTTPS server
 */
export const makeTLSServer = () =>  A.of((_: HTTPSConfig) => _)
/**
 * Creates a handle for a server
 */
export const makeHandle = (fn: (req: Request) => Response | Promise<Response>) => A.pure({
    handle: A.from(({ request }: HandleEnv) => Promise.resolve(fn(request)))
})
/**
 * Supplies a config to a sever
 */
export const withConfig = <R>(config: UIO<R>) => <E,A>(self: Async<R,E,A>) => config.provideTo(self)
/**
 * Runs a server
 */
export const listen = (msg?: string, logger=console.log) => (self: Server) => 
    self
    .chain((config) => {
        return A.from(async () => {
            const server = internalMakeListener(config);
            logger(msg ?? `Listening on port ${config.port}...`);
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
        })
    })
    .run();
