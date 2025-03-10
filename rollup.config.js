export default {
  input: 'src/turtle.js',
  output: [
    { file: 'dist/turtle.js', format: 'cjs' },
    { file: 'dist/turtle.esm.js', format: 'es' },
    { file: 'dist/turtle.umd.js', format: 'umd', name: 'TurtleJS' },
    // { file: 'test/dist/turtle.js', format: 'cjs' },
    // { file: 'test/dist/turtle.esm.js', format: 'es' },
    // { file: 'test/dist/turtle.umd.js', format: 'umd', name: 'TurtleJS' },
    { file: 'examples/dist/turtle.js', format: 'cjs' },
    { file: 'examples/dist/turtle.esm.js', format: 'es' },
    { file: 'examples/dist/turtle.umd.js', format: 'umd', name: 'TurtleJS' }

  ],
  plugins: []
};
