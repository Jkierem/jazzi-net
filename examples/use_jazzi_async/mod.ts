import * as A from "https://deno.land/x/jazzi@v4.1.0/Async/mod.ts"
import * as S from '../../core/server.ts'
import * as R from '../../core/router.ts'
import * as C from '../../core/config.ts'

const port = 3000

const helloAsync = A.from(({ results, request }: R.HandleInput) => 
    Promise.resolve(results.respond(`Hello ${request.hostname}!`))
)

const router = R.makeRouter()
    ['|>'](R.useDebugRoute("*","%method %pathname"))
    ['|>'](R.useAsync("GET", "/", helloAsync))

const config = C.makeConfig()
    ['|>'](C.withPort(port))
    ['|>'](C.withRouter(router))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen())