import { Status, STATUS_TEXT } from 'deno/http/http_status.ts'

export const BadRequest = () => new Response("400 Bad Request", { 
    status: Status.BadRequest, 
    statusText: STATUS_TEXT.get(Status.BadRequest)
})

export const NotFound = () => new Response("404 Not Found", {
    status: Status.NotFound,
    statusText: STATUS_TEXT.get(Status.NotFound)
})