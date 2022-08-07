# Jazzi-net

Library for making HTTP/S servers in Deno. It's a wrapper around Deno's http server. Inspired by effect-ts pipe style.

## Usage

The library has 3 modules: config, router and server. Although you can make a server with just the server module, the advised way to do it is by using all three: router to configure endpoints, config to setup server configuration and server to run the http/s server. A complete hello world would look like this:

```ts
import * as S from 'https/deno.land/x/jazzi_net@1.0.1/core/server.ts';
import * as R from 'https/deno.land/x/jazzi_net@1.0.1/core/router.ts';
import * as C from 'https/deno.land/x/jazzi_net@1.0.1/core/config.ts';

const router = R.makeRouter()
    ['|>'](R.get("/hello", (_, r) => r.respond("Hello world!")))

const config = C.makeConfig()
    ['|>'](C.withPort(3000))
    ['|>'](C.withRouter(router))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port 3000`))
```

For a more detailed view, look at OVERVIEW.md