export function assert(val: boolean): asserts val {
    if (val !== true) {
        throw new Error('assertion failed');
    }
}

export function choose<T>(list: Array<T>): T {
    let index = Math.random() * list.length | 0;
    return list[index];
}

export const ANIMALS = [
    'alligator',
    'anteater',
    'armadillo',
    'aurochs',
    'axolotl',
    'badger',
    'bat',
    'beaver',
    'buffalo',
    'camel',
    'capybara',
    'chameleon',
    'cheetah',
    'chinchilla',
    'chipmunk',
    'chupacabra',
    'cormorant',
    'coyote',
    'crow',
    'dingo',
    'dinosaur',
    'dolphin',
    'duck',
    'elephant',
    'ferret',
    'fox',
    'frog',
    'giraffe',
    'gopher',
    'grizzly',
    'hedgehog',
    'hippo',
    'hyena',
    'ibex',
    'ifrit',
    'iguana',
    'jackal',
    'jackalope',
    'kangaroo',
    'koala',
    'kraken',
    'lemur',
    'leopard',
    'liger',
    'llama',
    'manatee',
    'mink',
    'monkey',
    'moose',
    'narwhal',
    'nyan Cat',
    'orangutan',
    'otter',
    'panda',
    'penguin',
    'platypus',
    'pumpkin',
    'python',
    'quagga',
    'rabbit',
    'raccoon',
    'rhino',
    'sheep',
    'shrew',
    'skunk',
    'slow Loris',
    'squirrel',
    'tiger',
    'turtle',
    'walrus',
    'wolf',
    'wolverine',
    'wombat',
];
