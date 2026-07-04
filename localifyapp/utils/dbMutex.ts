let queue:Promise<any> = Promise.resolve()

export function withDbLock<T>(fn:()=>Promise<T>):Promise<T>{
    const result = queue.then(fn, fn)
    queue = result.then(()=>undefined, ()=>undefined)
    return result
}