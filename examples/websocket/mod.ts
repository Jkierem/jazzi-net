import * as S from '../../core/server.ts'
import * as R from '../../core/router.ts'
import * as C from '../../core/config.ts'

const port = 3000;

const router = R.makeRouter()
    ['|>'](R.get("/ws", (_, r) => {
        // Custom websocket verification would be here
        return r.continue()
    }))
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

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port ${port}`))