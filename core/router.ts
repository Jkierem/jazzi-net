import { Async as A, Maybe as M, Either as E } from './deps/jazzi/mod.ts';
import type { AsyncUIO, Async } from './deps/jazzi/async-type.ts';
import { readableStreamFromReader } from "./deps/deno/streams.ts";
import { join } from "./deps/deno/path.ts";
import { walk } from "./deps/deno/fs.ts";
import { NotFound, BadRequest, getExtensionByMIME } from "./common.ts";

export interface JazziRequest {
    raw: Request
    url: URL,
    hostname: string
    method: Method
    pathname: string
    params: Params
    query: URLSearchParams
}

export interface Router {
    queue: RouteHandle[],
    handle: (req: Request) => Promise<Response>
}
export type RouterAsync = AsyncUIO<Router>
export type Continuation = (fn: Response) => (Response | Promise<Response>)
export type Respond = { type: "respond", response: Response }
export type Continue = { type: "continue", continuation?: Continuation }
export type RouteResult = Continue | Respond 

export type Params = Record<string, string>

export const RouteResults = {
    continue: () => ({ type: "continue", continuation: undefined } as RouteResult),
    continueWith: (continuation: Continuation) => ({ type: "continue", continuation } as RouteResult),
    respond: (body?: BodyInit | null | undefined, init?: ResponseInit | undefined) => ({ type: "respond", response: new Response(body, init) } as RouteResult),
    respondWith: (response: Response) => ({ type: "respond", response } as RouteResult),
}

export type RouteHandle = (req: JazziRequest, ctor: typeof RouteResults) => RouteResult | Promise<RouteResult>

const makeJazziRequest = (req: Request): JazziRequest => {
    const urlObj = new URL(req.url);
    return {
        raw: req,
        url: urlObj,
        hostname: urlObj.hostname,
        method: req.method as Method,
        pathname: urlObj.pathname,
        query: urlObj.searchParams,
        params: {}
    }
}

export type RouterOptions = {
    fallback?: (req: Request) => Response | Promise<Response>
}

const applyContinuations = (continuations: Continuation[]) => async (r: Response): Promise<Response> => {
    let curr = r;
    for( const fn of continuations ){
        curr = await fn(curr)
    }
    return curr
}

export const makeRouter = (opts: RouterOptions = {}) => A.Success({ 
    queue: [] as RouteHandle[],
    async handle(req){
        const continuations = [] as Continuation[]
        const finishResponse = applyContinuations(continuations)
        for(const h of this.queue){
            const r = await h(makeJazziRequest(req), RouteResults)
            switch(r.type){
                case "continue":
                    if (r.continuation)
                        continuations.push(r.continuation)
                break;
                case "respond":
                    return finishResponse(r.response)
            }
        }
        const { fallback=NotFound } = opts
        return finishResponse(await fallback(req));
    }
} as Router)

const Methods = [
    "GET", "HEAD", "POST", 
    "PUT", "DELETE", "CONNECT", 
    "OPTIONS", "TRACE", "PATCH", "*"
] as const
type Method = typeof Methods[number];

const pathnameTest = (path: string) => (pathname: string) => {
    const res = new URLPattern({
        pathname: path,
        protocol: "*",
        hostname: "*"
    }).exec({ pathname })
    return M.fromNullish(res)
}

const toParams = (p: URLPatternResult) => ({ ...p.pathname.groups, toString: () => JSON.stringify(p.pathname.groups) } as Record<string, string>)

const methodTest = (method: Method) => (received: Method) => M.fromFalsy(method === "*" || method === received)

const methodHandle = (method: Method) => (path: string, fn: RouteHandle) => (self: RouterAsync) => {
    const maybeMethod = methodTest(method)
    const maybePathname = pathnameTest(path)
    return self.map(r => {
        const handle = (req: JazziRequest, kls: typeof RouteResults) => 
            maybeMethod(req.method)
                .chain(() => maybePathname(req.pathname))
                .map(toParams)
                .map((params) => fn({ ...req, params }, kls))
                .onNone(() => RouteResults.continue())
        
        return {
            handle: r.handle,
            queue: [...r.queue, handle]
        }
    })
}

/**
 * Adds a handler to a path that triggers for GET requests
 */
export const get = methodHandle("GET")
/**
 * Adds a handler to a path that triggers for HEAD requests
 */
export const head = methodHandle("HEAD")
/**
 * Adds a handler to a path that triggers for POST requests
 */
export const post = methodHandle("POST")
/**
 * Adds a handler to a path that triggers for PUT requests
 */
export const put = methodHandle("PUT")
/**
 * Adds a handler to a path that triggers for DELETE requests
 */
export const del = methodHandle("DELETE")
/**
 * Adds a handler to a path that triggers for CONNECT requests
 */
export const connect = methodHandle("CONNECT")
/**
 * Adds a handler to a path that triggers for OPTIONS requests
 */
export const options = methodHandle("OPTIONS")
/**
 * Adds a handler to a path that triggers for TRACE requests
 */
export const trace = methodHandle("TRACE")
/**
 * Adds a handler to a path that triggers for PATCH requests
 */
export const patch = methodHandle("PATCH")
/**
 * Adds a handler to a path that triggers for all kinds requests
 */
export const all = methodHandle("*")
/**
 * Adds a route handler for a given path with the given method
 */
export const useRoute = (method: Method, path: string, fn: RouteHandle) => 
    methodHandle(method)(path, fn)
/**
 * Adds a handler that is called on any request
 */
export const useAny = (fn: RouteHandle) => methodHandle("*")("*", fn)

/**
 * Used to send messages to a logger on every path and any request method when a request is received. 
 * The format is used to create the message sent to the logger. 
 * Interpolation of request information can be done via %attr,
 * where %attr will be replaced by the string value of request[attr] 
 * (i.e. %pathname with be replaced by request.pathname)
 */
export const useDebug = (format: string, logger=console.log) => 
    useRoute("*", "*", (req, r) => {
        const formatted = format.replaceAll(
            /%[a-z]*/g,
            (match) => `${req[match.replaceAll("%", "") as keyof JazziRequest]}`
        )
        logger(formatted)
        return r.continue()
    })

/**
 * Used to send messages to a logger on a given path and any request method when a request is received. 
 * The format is used to create the message sent to the logger. 
 * Interpolation of request information can be done via %attr,
 * where %attr will be replaced by the string value of request[attr] 
 * (i.e. %pathname with be replaced by request.pathname)
 */
export const useDebugRoute = (path: string, format: string, logger=console.log) => 
    useRoute("*", path, (req, r) => {
        const formatted = format.replaceAll(
            /%[a-z]*/g,
            (match) => `${req[match.replaceAll("%", "") as keyof JazziRequest]}`
        )
        logger(formatted)
        return r.continue()
    })

/**
 * Used to send messages to a logger on every path and any request method when a response is sent. 
 * The format is used to create the message sent to the logger. 
 * Interpolation of response information can be done via %attr,
 * where %attr will be replaced by the string value of response[attr] 
 * (i.e. %pathname with be replaced by response.pathname)
 */    
export const useDebugResponse = (format: string, logger=console.log) => 
    useRoute("*", "*", (_, r) => {
        return r.continueWith((res: Response) => {
            const formatted = format.replaceAll(
                /%[a-z]*/g,
                (match) => `${res[match.replaceAll("%", "") as keyof Response]}`
            )
            logger(formatted)
            return res
        })
    })

/**
 * Used to send messages to a logger on a given path and any request method when a response is sent. 
 * The format is used to create the message sent to the logger. 
 * Interpolation of response information can be done via %attr,
 * where %attr will be replaced by the string value of response[attr] 
 * (i.e. %pathname with be replaced by response.pathname)
 */
export const useDebugResponseRoute = (path: string, format: string, logger=console.log) => 
    useRoute("*", path, (_, r) => {
        return r.continueWith((res: Response) => {
            const formatted = format.replaceAll(
                /%[a-z]*/g,
                (match) => `${res[match.replaceAll("%", "") as keyof Response]}`
            )
            logger(formatted)
            return res
        })
    })

type RegisterWebSocket = (socket: WebSocket) => void

/**
 * Handler for websocket connections. Will use secure websocket if called on a https server
 */
export const useWebSocket = (path: string, fn: RegisterWebSocket, onError: (req: JazziRequest) => Response = BadRequest) => 
    useRoute("GET", path, (req) => {
        const getUpgrade = (req: Request) => (req.headers.get('upgrade') || "").toLowerCase()
        return E
            .fromCondition((req) => getUpgrade(req) === "websocket", req.raw)
            .map(req => {
                const { socket, response } = Deno.upgradeWebSocket(req)
                fn(socket)
                return RouteResults.respondWith(response)
            })
            .getRightOr(() => RouteResults.respondWith(onError(req)))
    })


type UnknownError = { type: "UnknownError", error: unknown }
type DisallowedIndexResolution = { type: "DisallowedIndexResolution" }
type StaticError = UnknownError | DisallowedIndexResolution

type StaticOptions = {
    onError?: (req: JazziRequest, reason: StaticError) => Response | Promise<Response>
    resolveIndexFile?: (acceptHeader: string | null) => string | Promise<string>
    allowIndexResolution?: boolean
}

/**
 * Serves static files from a folder over http/s. Index resolution is enabled by default.
 */
export const useStaticFolder = (path: string, folder: string, opts: StaticOptions = {}) => {
    const {
        allowIndexResolution = true,
        resolveIndexFile,
        onError = NotFound,
    } = opts;

    return useRoute("GET", path, async (req) => {
        const prefix = path.replace("*", "");
        let filePath = decodeURIComponent(join(folder, req.pathname.replace(prefix, "")));
        let info;
        try {
            info = await Deno.lstat(filePath)
        } catch(e) {
            const res = await onError(req, { type: "UnknownError", error: e })
            return RouteResults.respondWith(res);
        }
        if(info.isDirectory){
            if( allowIndexResolution ){
                const acceptHeader = req.raw.headers.get("Accept");
                if( resolveIndexFile ){
                    const indexFile = await resolveIndexFile(acceptHeader)
                    filePath = join(filePath, indexFile);
                } else {
                    const files = walk(filePath, { 
                        followSymlinks: false, 
                        includeFiles: true, 
                        includeDirs: false,
                        maxDepth: 1,
                    })
                    const indeces = []
                    for await(const f of files){
                        if(f.name.startsWith("index")){
                            indeces.push(f)
                        }
                    }
    
                    const knownIndeces = (acceptHeader ?? "text/plain")
                        .split(",")
                        .map(x => x.split(";")[0])
                        .map(x => getExtensionByMIME(x))
                        .filter(x => x.isJust())
                        .map(x => `index${x.get()}`)
    
                    indeces.sort((a,b) => {
                        const aname = a.name;
                        const bname = b.name;
                        const isAKnown = knownIndeces.includes(aname)
                        const isBKnown = knownIndeces.includes(bname)
        
                        if( isAKnown && isBKnown ){
                            return knownIndeces.indexOf(aname) - knownIndeces.indexOf(bname);
                        } else if(isAKnown && !isBKnown){
                            return -1;
                        } else if (!isAKnown && isBKnown){
                            return 1;
                        } else {
                            return  a.name.localeCompare(b.name);
                        }
                    })
                    filePath = join(filePath, indeces[0]?.name ?? "");
                }
            } else {
                const res = await onError(req, { type: "DisallowedIndexResolution" })
                return RouteResults.respondWith(res)
            }
        }

        let file;
        try {
            file = await Deno.open(filePath, { read: true });
        } catch(e) {
            const res = await onError(req, { type: "UnknownError", error: e })
            return RouteResults.respondWith(res);
        }

        const stream = readableStreamFromReader(file)

        return RouteResults.respondWith(new Response(stream))
    })
}

export type HandleInput = {
    results: typeof RouteResults,
    request: JazziRequest
}

export type AsyncHandle = Async<HandleInput, never, RouteResult>

export const useAsync = (method: Method, path: string, self: AsyncHandle) =>
    methodHandle(method)(path, (request, results) => self.run({ results, request }))