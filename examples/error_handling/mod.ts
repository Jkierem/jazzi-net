import * as S from "../../core/server.ts"
import * as C from "../../core/config.ts"
import * as R from "../../core/router.ts"

const router = R.makeRouter()
    ['|>'](R.useWebSocket("/ws", (socket) => {
        socket.onopen = () => console.log("connected")
        socket.onclose = () => console.log("disconnected")
    }))

const config = C.makeConfig()
    ['|>'](C.withPort(3000))
    ['|>'](C.withRouter(router))
    ['|>'](C.withCertificate({ 
        certFile: "./examples/error_handling/cert.txt", 
        keyFile: "./examples/error_handling/key.txt" 
    }))
    ['|>'](C.withConnectionError((e, r) => {
        console.log("Connection error", e)
        return r.retry()
    }))
    ["|>"](C.withHttpFallback((e) => {
        console.log("Falling back to http. Reason:", (e as Error).message)
    }))

S.makeTLSServer()
['|>'](S.withConfig(config))
['|>'](S.listen());