import { Async as A, Maybe as M, Either as E } from 'jazzi/mod.ts'
import type { AsyncUIO } from 'jazzi/Async/types.ts'
import { Status, STATUS_TEXT } from 'deno/http/http_status.ts'

export interface JazziRequest {
    raw: Request
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

const unhandledRoute = () => new Response("404 Not Found", { status: 404, statusText: "Not Found" })

const makeJazziRequest = (req: Request): JazziRequest => {
    const urlObj = new URL(req.url);
    return {
        raw: req,
        hostname: urlObj.hostname,
        method: req.method as Method,
        pathname: urlObj.pathname,
        query: urlObj.searchParams,
        params: {}
    }
}

export const makeRouter = () => A.Success({ 
    queue: [] as RouteHandle[],
    async handle(req){
        for(const h of this.queue){
            const r = await h(makeJazziRequest(req), RouteResults)
            if( r.type === "respond" ){
                return r.response
            }
        }
        return unhandledRoute();
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

const BadRequest = () => new Response("", { 
    status: Status.BadRequest, 
    statusText: STATUS_TEXT.get(Status.BadRequest)
})

type RegisterWebSocket = (socket: WebSocket) => void

export const useWebSocket = (path: string, fn: RegisterWebSocket, onNotWebSocket: (req: JazziRequest) => Response = BadRequest) => 
    useRoute("GET", path, (req) => {
        const getUpgrade = (req: Request) => (req.headers.get('upgrade') || "").toLowerCase()
        return E
            .fromCondition((req) => getUpgrade(req) === "websocket", req.raw)
            .map(req => {
                const { socket, response } = Deno.upgradeWebSocket(req)
                fn(socket)
                return RouteResults.respondWith(response)
            })
            .getRightOr(() => RouteResults.respondWith(onNotWebSocket(req)))
    })