# TurtleJS

A feature-rich JavaScript implementation of turtle graphics inspired by Python's `turtle` module. TurtleJS uses HTML canvas for rendering and supports animated drawing operations, coordinate transformations, and most features from Python's turtle graphics.

## Installation

```html
<script type="module">
  import { Turtle, Screen } from './turtle.js';
</script>
```

## Basic Usage

```html
<canvas id="turtleCanvas" width="800" height="600"></canvas>

<script type="module">
  import { Turtle, Screen } from './turtle.js';
  
  // Create a screen from canvas
  const canvas = document.getElementById('turtleCanvas');
  const screen = new Screen(canvas);
  
  // Create a turtle
  const t = new Turtle(screen);
  
  // Draw a square
  async function drawSquare() {
    for (let i = 0; i < 4; i++) {
      await t.forward(100);
      await t.right(90);
    }
  }
  
  drawSquare();
</script>
```

## Features

- **Full Turtle Movement**: Forward/backward movement, rotation, positioning
- **Pen Controls**: Color, width, up/down state
- **Fill Operations**: Fill shapes with colors
- **Animation**: Control drawing speed with smooth animations
- **Coordinate System**: Flexible world coordinate system
- **Shapes**: Multiple turtle shapes (arrow, turtle, square, etc.)
- **Text and Stamps**: Write text and create stamps
- **Event Handling**: Click and keyboard events
- **Undo Support**: Revert previous operations

## Examples

### Drawing a Spiral

```javascript
async function drawSpiral() {
  t.speed(8);
  for (let i = 0; i < 100; i++) {
    await t.forward(i * 2);
    await t.right(90);
  }
}
```

### Drawing a Star

```javascript
async function drawStar(size) {
  await t.begin_fill();
  for (let i = 0; i < 5; i++) {
    await t.forward(size);
    await t.right(144);
  }
  await t.end_fill();
}
```

## API Reference

TurtleJS implements most methods from Python's turtle module:

### Movement
- `forward(distance)`, `fd(distance)`
- `backward(distance)`, `bk(distance)`, `back(distance)`
- `right(angle)`, `rt(angle)`
- `left(angle)`, `lt(angle)`
- `goto(x, y)`, `setpos(x, y)`, `setposition(x, y)`
- `setx(x)`, `sety(y)`
- `setheading(angle)`, `seth(angle)`
- `home()`
- `circle(radius, extent, steps)`

### Pen Control
- `pendown()`, `pd()`, `down()`
- `penup()`, `pu()`, `up()`
- `pensize(width)`, `width(width)`
- `pencolor(...color)`
- `fillcolor(...color)`
- `begin_fill()`, `end_fill()`

### State
- `hideturtle()`, `ht()`
- `showturtle()`, `st()`
- `isvisible()`
- `speed(speed)`

### More Advanced
- `write(text, move, align, font)`
- `dot(size, color)`
- `stamp()`, `clearstamp(stampid)`
- `undo()`

## Notes

- All drawing operations return Promises that resolve when the animation completes
- Use `await` with turtle operations for sequential execution
- Speed values range from 1 (slowest) to 10 (fastest), with 0 for instant drawing
- Colors accept names, hex values, RGB arrays, and more

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
```
