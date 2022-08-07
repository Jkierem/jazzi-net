import * as S from '../../core/server.ts'
import * as R from '../../core/router.ts'
import * as C from '../../core/config.ts'

const port = 3000

const appendHeader = (name: string, value: string) => (res: Response) => {
    res.headers.append(name, value)
    return res
}

const router = R.makeRouter()
    ['|>'](R.useDebugRoute("*","%method %pathname"))
    ['|>'](R.useAny((_, r) => r.continueWith(appendHeader("custom-header", "This is added on every request"))))
    ['|>'](R.get("/hello", (_, r) => r.continueWith(appendHeader("custom-header-2", "This is added on GET /hello"))))
    ['|>'](R.get("/hello", (_, r) => r.respond("Check the headers")))

const config = C.makeConfig()
    ['|>'](C.withPort(port))
    ['|>'](C.withRouter(router))
    ['|>'](C.withError((e) => console.log("Req Error:", e)))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port ${port}`))