import * as S from '../../core/server.ts'
import * as R from '../../core/router.ts'
import * as C from '../../core/config.ts'
import { join } from "https://deno.land/std@0.140.0/path/mod.ts";

const port = 3000
const publicFolder = join(Deno.cwd(), "examples", "file_server", "public")

const router = R.makeRouter()
    ['|>'](R.useDebugRoute("*","%method %pathname"))
    ['|>'](R.useStaticFolder("/home*", publicFolder))

const config = C.makeConfig()
    ['|>'](C.withPort(port))
    ['|>'](C.withRouter(router))
    ['|>'](C.withError((e) => console.log("Req Error:", e)))

S.makeServer()
['|>'](S.withConfig(config))
['|>'](S.listen(`Listening on port ${port}`))