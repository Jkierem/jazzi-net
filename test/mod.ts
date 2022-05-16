import * as S from '../core/server.ts'
import * as R from '../core/router.ts'

const port = 80

const router = R.makeRouter()
    ['|>'](R.get("/some", (req, r) => {
        return r.respond(new Response("Hello World"))
    }))

const config = S.makeConfig()
    ['|>'](S.withPort(port))
    ['|>'](S.withRouter(router))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port ${port}`))