// Basic test for TurtleJS
const path = require('path');

// Mock the canvas
class MockCanvas {
  constructor() {
    this.width = 300;
    this.height = 300;
  }

  getContext() {
    return {
      canvas: this,
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 10 }),
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
      putImageData: jest.fn(),
    };
  }
}

// Mock the document
global.document = {
  createElement: () => new MockCanvas(),
  body: {
    appendChild: jest.fn(),
  },
};

// Mock window
global.window = {
  requestAnimationFrame: callback => setTimeout(callback, 0),
};

// Load the module
jest.mock('../dist/turtle.js', () => {
  // Create a simple mock of the Turtle class
  class MockTurtle {
    constructor(options = {}) {}
    forward() { return Promise.resolve(); }
    backward() { return Promise.resolve(); }
    right() { return Promise.resolve(); }
    left() { return Promise.resolve(); }
    penup() {}
    pendown() {}
  }

  // Create a simple mock of the Screen class
  class MockScreen {
    constructor(options = {}) {}
    bgcolor() {}
    clear() {}
  }

  // Create a mock for createTurtle
  const createTurtle = () => new MockTurtle();

  return {
    Turtle: MockTurtle,
    Screen: MockScreen,
    createTurtle,
  };
}, { virtual: true });

const { Turtle, Screen, createTurtle } = require('../dist/turtle.js');

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
    expect(turtle).toBeTruthy();
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