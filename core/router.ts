import { Async as A, Maybe as M, Either as E } from './deps/jazzi/mod.ts';
import type { AsyncUIO } from './deps/jazzi/async-type.ts';
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
    handle: (req: Request, server: Deno.Listener) => Promise<Response>
}
export type RouterAsync = AsyncUIO<Router>
export type Respond = { type: "respond", response: Response }
export type Continue = { type: "continue" }
export type RouteResult = Continue | Respond 

export type Params = Record<string, string>

export const RouteResults = {
    continue: () => ({ type: "continue" } as RouteResult),
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

export const makeRouter = (opts: RouterOptions = {}) => A.Success({ 
    queue: [] as RouteHandle[],
    async handle(req){
        for(const h of this.queue){
            const r = await h(makeJazziRequest(req), RouteResults)
            if( r.type === "respond" ){
                return r.response
            }
        }
        const { fallback=NotFound } = opts
        return await fallback(req);
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

export const get = methodHandle("GET")
export const head = methodHandle("HEAD")
export const post = methodHandle("POST")
export const put = methodHandle("PUT")
export const del = methodHandle("DELETE")
export const connect = methodHandle("CONNECT")
export const options = methodHandle("OPTIONS")
export const trace = methodHandle("TRACE")
export const patch = methodHandle("PATCH")
export const useRoute = (method: Method, path: string, fn: RouteHandle) => 
    methodHandle(method)(path, fn)

export const useDebug = (format: string, logger=console.log) => 
    useRoute("*", "*", (req, r) => {
        const formatted = format.replaceAll(
            /%[a-z]*/g,
            (match) => `${req[match.replaceAll("%", "") as unknown as keyof JazziRequest]}`
        )
        logger(formatted)
        return r.continue()
    })

export const useDebugRoute = (path: string, format: string, logger=console.log) => 
    useRoute("*", path, (req, r) => {
        const formatted = format.replaceAll(
            /%[a-z]*/g,
            (match) => `${req[match.replaceAll("%", "") as unknown as keyof JazziRequest]}`
        )
        logger(formatted)
        return r.continue()
    })

type RegisterWebSocket = (socket: WebSocket) => void

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