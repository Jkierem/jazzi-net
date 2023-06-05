import * as R from "./router.ts"

export const appendHeader = (name: string, val: string) => (res: Response) => {
    res.headers.append(name, val)
    return res;
}

export const appendHeaderContinuation = 
    (name: string, val: string) => () => R.RouteResults.continueWith(appendHeader(name, val))