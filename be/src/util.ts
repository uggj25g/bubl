export function assert(val: boolean): asserts val {
    if (val !== true) {
        throw new Error('assertion failed');
    }
}
