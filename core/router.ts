import { Async as A } from 'jazzi/mod.ts'
import type { AsyncUIO } from 'jazzi/Async/types.ts'

export interface JazziRequest {
    raw: Request
    method: Method
    route: string
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

const unhandledRoute = () => new Response("404 Not Found", { status: 404 })

const makeJazziRequest = (req: Request): JazziRequest => {
    const urlObj = new URL(req.url);
    return {
        raw: req,
        method: req.method as Method,
        route: urlObj.pathname,
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

const getRouteInfo = (path: string) => {
    const regexp = path.replaceAll(/\/:[A-Za-z]*/gm, (m) => {
        const p = m.slice(2).replace("/", "")
        return `/(?<${p}>[A-Za-z0-9_.~%]*)`
    })
    return () => new RegExp(regexp)
}

const matchesPath = (reg: RegExp, route: string) => reg.test(route)

const matchesMethod = (method: Method, received: Method) => 
    method === "*" || method === received

const methodHandle = (method: Method) => (path: string, fn: RouteHandle) => (self: RouterAsync) => 
    self.map(r => {
        const pathReg = getRouteInfo(path);
        r.queue.push((req, kls) => {
            if( matchesMethod(method, req.method) && (path === "*" || matchesPath(pathReg(), req.route))){
                req.params = path === "*" 
                    ? {} 
                    : pathReg().exec(req.route)?.groups ?? {};
                req.params.toString = () => JSON.stringify(req.params)
                return fn(req, kls);
            }
            return RouteResults.continue();
        })
        return r
    })

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