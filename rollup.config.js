import terser from '@rollup/plugin-terser';

export default {
  input: 'src/turtle.js',
  output: [
    { file: 'dist/turtle.js', format: 'cjs' },
    { file: 'dist/turtle.esm.js', format: 'es' },
    { file: 'dist/turtle.umd.js', format: 'umd', name: 'turtlejs' },
    // { file: 'test/dist/turtle.js', format: 'cjs' },
    // { file: 'test/dist/turtle.esm.js', format: 'es' },
    // { file: 'test/dist/turtle.umd.js', format: 'umd', name: 'turtlejs' },
    { file: 'examples/dist/turtle.js', format: 'cjs' },
    { file: 'examples/dist/turtle.esm.js', format: 'es' },
    { file: 'examples/dist/turtle.umd.js', format: 'umd', name: 'turtlejs' },
    // Minified versions
    { file: 'dist/turtle.min.js', format: 'cjs', plugins: [terser()] },
    { file: 'dist/turtle.esm.min.js', format: 'es', plugins: [terser()] },
    { file: 'dist/turtle.umd.min.js', format: 'umd', name: 'turtlejs', plugins: [terser()] }
  ],
  plugins: []
};
