export type Deferred<T> = {
    promise: Promise<T>,
    resolve: (val: T) => void,
    reject: (err: any) => void,
};

export function deferred<T>(): Deferred<T> {
    let resolve: Deferred<T>["resolve"] | undefined;
    let reject: Deferred<T>["reject"] | undefined;
    let promise = new Promise<T>((resolve_, reject_) => {
        resolve = resolve_;
        reject = reject_;
    });
    return {
        promise,
        resolve: resolve!,
        reject: reject!,
    };
}

export function debug_log(format: string, ...args: any) {
    if (import.meta.env.DEV) {
        console.log(format, ...args);
    }
}
