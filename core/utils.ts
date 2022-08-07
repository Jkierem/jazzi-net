import type { Async } from './deps/jazzi/async-type.ts'

export const simplify = <R,E,A>(self: Async<R,E,A>) => self.map<{ [P in keyof A]: A[P] }>(x => x)