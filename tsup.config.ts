import { defineConfig } from 'tsup';

const external = ['react', 'react-native', 'react-native-reanimated', '@legendapp/list'];

export default defineConfig({
    entry: ['src/index.ts', 'src/animated.tsx', 'src/reanimated.tsx'],
    format: ['cjs', 'esm'],
    external,
    dts: true,
    treeshake: true,
    splitting: false,
    clean: true,
});
