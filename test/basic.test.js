// Basic test for TurtleJS
let Turtle, Screen, createTurtle;

beforeAll(async () => {
  const module = await import('../dist/turtle.esm.js');
  Turtle = module.Turtle;
  Screen = module.Screen;
  createTurtle = module.createTurtle;
});

describe('TurtleJS', () => {
  test('Turtle class exists', () => {
    expect(Turtle).toBeDefined();
  });

  test('Screen class exists', () => {
    expect(Screen).toBeDefined();
  });

  test('createTurtle function exists', () => {
    expect(createTurtle).toBeDefined();
  });

  test('Turtle instance can be created', () => {
    const turtle = new Turtle();
    expect(turtle).toBeInstanceOf(Turtle);
  });

  test('Turtle has basic methods', () => {
    const turtle = new Turtle();
    expect(typeof turtle.forward).toBe('function');
    expect(typeof turtle.backward).toBe('function');
    expect(typeof turtle.right).toBe('function');
    expect(typeof turtle.left).toBe('function');
    expect(typeof turtle.penup).toBe('function');
    expect(typeof turtle.pendown).toBe('function');
  });
}); 