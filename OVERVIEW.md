## Overview

Jazzi-net is based around jazzi asyncs. So everything in the library is modeled using Jazzi Asyncs.

### Server

A wrapper around Deno.listen/listenTls. A Server is an Async that requires a configuration object. There are two kinds: http and https. The only difference between the two is that the https requires the certificate information. The configuration needed for either are the following:

```ts
interface HTTPConfig {
    port: number
    handle: Handle
    hostname?: string
    onError?: (err: unknown) => void
    onConnectionError?: (err: unknown) => void
}

interface HTTPSConfig {
    port: number
    handle: Handle
    hostname?: string
    certFile: string,
    keyFile: string,
    onError?: (err: unknown) => void
    onConnectionError?: (err: unknown) => void
    fallbackHttp?: boolean,
    onFallback?: (e: unknown) => void
}
```

The config is passed to Deno.listen/Deno.listenTls. The onError callback is used when an error occurs on a request. OnConnection is used when listening to connection throws. HttpsServers have a special behaviour of falling back to an HttpServer if Deno.listenTls throws. This is opt-in through the fallbackHttp and onFallback options. If fallbackHttp is true, then if Deno.listenTls fails, it will call the onFallback function if present and then call Deno.listen with the same configuration. Otherwise, the process will simply throw the error that Deno.listenTls threw. All a server does is run the handle when a request is received, responding the request with what the handle resolves to.

The package exposes the following functions:

```ts
function makeServer(): Async<HTTPConfig, unknown, HTTPConfig>;
``` 
-  Creates an http server

```ts
function makeTLSServer(): Async<HTTPSConfig, unknown, HTTPSConfig>;
``` 
-  Creates an https server

```ts
type Handle = Async<HandleEnv, never, Response>
function makeHandle(fn: (req: Request, server: Deno.Listener) => Response | Promise<Response>): Async<unknown, never, {
    handle: Handle;
}>;
```
-  Creates a handle ready to be supplied to a server

```ts
function withConfig<R>(config: Async<unknown, never, R>): <E,A>(self: Async<R,E,A>) => Async<unknown, E, A>
```
-  Provides a config to a server

```ts
function listen(msg?: string, logger=console.log): <E,A>(self: Async<unknown, E, A>) => A
```
-  Runs a server, logging msg if supplied upon server startup. The default message is "Listening on port \[port\]...".

A minimal server would look like this:

```ts
import * as S from 'https/deno.land/x/jazzi-net@1.0.0/core/server.ts';

const handle = S.makeHandle(() => new Response("Hello world!"))

S
.makeServer()
.run({
    handle,
    port: 3000
})
```

**Though this is not advised**

### Config

Module used to build the configuration for a server. It exposes the following functions:

```ts
function makeConfig(): Async<unknwon, never, {}>;
``` 
-  Creates an empty server configuration

```ts
function withPort(port: number): <R,E,A>(self: Async<R,E,A>): Async<unknwon, never, A & { port: number }>;
``` 
-  Adds a port to a config

```ts
function withHandle(handle: (req: Request, server: Deno.Listener) => Response | Promise<Response>): <R,E,A>(self: Async<R,E,A>): Async<unknwon, never, A & { handle: Handle }>;
``` 
-  Adds a handle to a config

```ts
function withRouter(router: Async<unknown, never, Router>): <R,E,A>(self: Async<R,E,A>): Async<unknwon, never, A & { handle: Handle }>;
``` 
-  Adds a router as handle to a config

```ts
type CertData = { certFile: string, keyFile: string }
function withCertificate(data: CertData): <R,E,A>(self: Async<R,E,A>): Async<unknwon, never, A & CertData>;
``` 
-  Adds certificate data to a config

```ts
function withError(onError: (e: unknown, server: Deno.Listener) => void): <A>(self: UIO<A>) => Async<unknown, never, A & { onError: (e: unknown, server: Deno.Listener) => void}>

function withConnectionError(onConnectionError: (e: unknown, server: Deno.Listener) => void): <A>(self: UIO<A>) => Async<unknown, never, A & { onConnectionError: (e: unknown, server: Deno.Listener) => void}>
```

- Add error handlers to a config

A minimal server using config would look like this:

```ts
import * as S from 'https/deno.land/x/jazzi-net@1.0.0/core/server.ts';
import * as C from 'https/deno.land/x/jazzi-net@1.0.0/core/config.ts';

const config = C.makeConfig()
    ['|>'](C.withPort(3000))
    ['|>'](C.withHandle(() => new Response("Hello world!")))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port 3000`))
```

### Router

The router module is used to add endpoints to the server. It revolves around the `useRoute` function. Usage is as follows:

```ts
import * as R from 'https/deno.land/x/jazzi-net@1.0.0/core/router.ts';

R.makeRouter()
['|>'](R.useRoute("GET", "/hello/:name", (req, results) => {
    return results.respond(`Hello ${req.params.name}!`)
}))
```

This creates a router that reponds hello to a GET request using the url to get the name. Route handlers can be async.

Unlike the server handle, route handles must return a RouteResult. There are two possible results: Continue, Respond. Continue does not respond and passes control to the next handler, appending a continuation to the queue of continuations. A continuation is simply a function that receives a response and returns a response or a promise of a response. All continuations are applied in order, passing the result of the previous to the next. Respond breaks the chain and responds with the given Response inside the Respond structure. Thus, if a handler with a Continue result is added after a handler with a Respond, then the Respond will execute before the Continue handler, and the Continue handler will be ignored

An object with constructors is passed as second argument to route handlers. There are four constructors for RouteResult: continue, continueWith, respond, respondWith:

```ts
import * as R from 'https/deno.land/x/jazzi-net@1.0.0/core/router.ts';

R.RouteResults.continue() // creates a continue result with no continuation
R.RouteResults.continueWith(x => x) // creates a continue result with the given continuation
R.RouteResults.respond(...args) // shorthand for respondWith(new Response(...args))
R.RouteResults.respondWith(new Response(...args)) // responds with given response
```

For convenience, there are aliases for `useRoute` for common http methods:

```ts
import * as R from 'https/deno.land/x/jazzi-net@1.0.0/core/router.ts';

R.get(path, handler)     // same as R.useRoute("GET", path, handler)
R.head(path, handler)    // same as R.useRoute("HEAD", path, handler)
R.post(path, handler)    // same as R.useRoute("POST", path, handler)
R.put(path, handler)     // same as R.useRoute("PUT", path, handler)
R.del(path, handler)     // same as R.useRoute("DELETE", path, handler)
R.connect(path, handler) // same as R.useRoute("CONNECT", path, handler)
R.options(path, handler) // same as R.useRoute("OPTIONS", path, handler)
R.trace(path, handler)   // same as R.useRoute("TRACE", path, handler)
R.patch(path, handler)   // same as R.useRoute("PATCH", path, handler)

// Other convenience operators
R.all(path, handler)     // same as R.useRoute("*", path, handler)
R.useAny(handler)        // same as R.useRoute("*", "*", handler)
```

The path is matched using `URLPattern`. For more info go to [MDN URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)

Another difference with server handle is that route handlers don't receive the raw request. Instead they receive a JazziRequest. To access the raw Request simply get the raw attribute of JazziRequest. The type is defined as follows:

```ts
type Method = 
 | "GET" 
 | "HEAD" 
 | "POST" 
 | "PUT" 
 | "DELETE" 
 | "CONNECT" 
 | "OPTIONS" 
 | "TRACE" 
 | "PATCH"

interface JazziRequest {
    raw: Request
    url: URL,
    hostname: string
    method: Method
    pathname: string
    params: Record<string, string>
    query: URLSearchParams
}
```

The order in which routes are added matters as this is the order in which routes get evaluated. If no route responds or no route is matched, the router will respond with a fallback. By default, the router has a fallback of responding with `404 Not Found`. If something else is desired, use the fallback option on router creation:

```ts
import * as R from 'https/deno.land/x/jazzi-net@1.0.0/core/router.ts';

R.makeRouter({ fallback: () => new Response("Nothing responded") })
```

The fallback is a function that receives the raw request and returns a response. Can be async.

The router module also has some utility functions: `useDebug`, `useDebugRoute`, `useStaticFolder`, and `useWebSocket`. They are shorthands for `useRoute` with a very specific handler. For examples of these look at the examples folder.

A minimal server with configuration and router looks like this:

```ts
import * as S from 'https/deno.land/x/jazzi-net@1.0.0/core/server.ts';
import * as R from 'https/deno.land/x/jazzi-net@1.0.0/core/router.ts';
import * as C from 'https/deno.land/x/jazzi-net@1.0.0/core/config.ts';

const router = R.makeRouter()
    ['|>'](R.get("/hello", (_, r) => {
        console.log("Received a hello");
        return r.continue()
    }))
    ['|>'](R.get("/hello", (_, r) => r.respond("Hello world!")))

const config = C.makeConfig()
    ['|>'](C.withPort(3000))
    ['|>'](C.withRouter(router))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port 3000`))
```

Check the examples folder for common use cases