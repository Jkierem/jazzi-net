import * as S from '../core/server.ts'
import * as R from '../core/router.ts'
import * as C from '../core/config.ts'
import { Async } from 'jazzi/mod.ts'

const port = 3000
const printLn = (x: unknown) => Async.of(() => console.log(x))

const router = R.makeRouter()
    ['|>'](R.useDebugRoute("/hello/:name/world","%method %route"))
    ['|>'](R.get("/hello/:name/world", (req, r) => r.respond(`Hello ${req.params.name}!`)))
    ['|>'](R.useWebSocket("/ws", (socket) => {
        socket.onopen = () => console.log("ws open")
        socket.onmessage = (e) => console.log("ws message:", e.data)
        socket.onerror = (e) => console.log("ws error", e)
        socket.onclose = () => console.log("ws close")
    }))

const config = C.makeConfig()
    ['|>'](C.withPort(port))
    ['|>'](C.withRouter(router))
    ['|>'](C.withError((e) => console.log("Req Error:", e)))

S.makeHTTP()
['|>'](S.withConfig(config))
['|>'](S.onConnectionError(printLn))
['|>'](S.listen(`Listening on port ${port}`))