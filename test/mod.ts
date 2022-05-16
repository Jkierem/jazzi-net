import * as S from '../core/server.ts'
import * as R from '../core/router.ts'

const port = 80

const router = R.makeRouter()
    ['|>'](R.useDebugRoute("/hello/:name/world","%method %route"))
    ['|>'](R.get("/hello/:name/world", (req, r) => {
        const { name } = req.params
        return r.respond(`Hello ${name}!`)
    }))

const config = S.makeConfig()
    ['|>'](S.withPort(port))
    ['|>'](S.withRouter(router))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port ${port}`))