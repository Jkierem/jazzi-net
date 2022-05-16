import { Async as A, Either as E } from 'jazzi/mod.ts'
import type { AsyncUIO } from 'jazzi/Async/types.ts'

export interface JazziRequest {
    raw: Request
    method: Method
    route: string
    params: Params
    query: QueryParams
}

export interface Router {
    queue: RouteHandle[],
    handle: (req: Request, server: Deno.Listener) => Promise<Response>
}
export type RouterAsync = AsyncUIO<Router>
export type Respond = { type: "respond", response: Response }
export type Continue = { type: "continue" }
export type RouteResult = Continue | Respond 

export type QueryParams = Record<string, string>
export type Params = Record<string, string>

export const RouteResults = {
    continue: () => ({ type: "continue" } as RouteResult),
    respond: (response: Response) => ({ type: "respond", response } as RouteResult)
}

export type RouteHandle = (req: JazziRequest, ctor: typeof RouteResults) => RouteResult | Promise<RouteResult>

const unhandledRoute = (route: string) => new Response(
    JSON.stringify({ message: `${route} not allowed` }),
    {
        status: 405,
        headers: {
            "content-type": "application/json"
        }
    }
)

const routeRegexp = () => /https?:\/\/.*\/(?<route>[^\?]*)(\?(?<query>[^\?]*))?/
type RegexResult = { route: string, query: string }
const parseURL = (str: string) => {
    return E.fromNullish(undefined, routeRegexp().exec(str))
        .map(res => res.groups as RegexResult)
}

const parseQuery = (query: string) => Object.fromEntries(query.split("&")
    .map(entry => entry.split("=") as [string, string])
    .filter(([_, value]) => value && value.trim().length > 0))

const makeJazziRequest = (req: Request): JazziRequest => {
    const base = {
        raw: req,
        method: req.method as Method
    }

    return parseURL(req.url)
        .map(data => ({
            ...base,
            params: {},
            query: parseQuery(data.query),
            route: data.route
        })).getRightOr({
            ...base,
            params: {},
            query: {},
            route: ""
        })
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
        return unhandledRoute(req.url);
    }
} as Router)

const Methods = [
    "GET", "HEAD", "POST", 
    "PUT", "DELETE", "CONNECT", 
    "OPTIONS", "TRACE", "PATCH", "*"
] as const
type Method = typeof Methods[number];

const matchesPath = (path: string, route: string) => path === route

const matchesMethod = (method: Method, received: Method) => 
    method === "*" || method === received

const methodHandle = (method: Method) => (path: string, fn: RouteHandle) => (self: RouterAsync) => 
    self.map(r => { 
        r.queue.push((req, kls) => {
            if( matchesMethod(method, req.method) && matchesPath(path, req.route)){
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